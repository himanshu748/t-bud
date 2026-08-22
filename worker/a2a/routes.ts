import { Hono, type Context } from "hono";
import { z } from "zod";
import { createWorkersAiModel } from "../ai/recommendation";
import { D1BookingRepository, type TaskRecord } from "../data/repository";
import { BookingTools } from "../domain/tools";
import type { Env } from "../env";
import { enforceRateLimit } from "../http/security";
import { AGENT_CARD_ETAG, createAgentCard } from "./agent-card";
import type { A2ATask, A2ATaskState, JsonRpcFailure, JsonRpcSuccess } from "./types";

type AppContext = { Bindings: Env };

const RpcRequest = z
  .object({
    jsonrpc: z.literal("2.0"),
    id: z.union([z.string(), z.number()]),
    method: z.string().min(1).max(80),
    params: z.record(z.string(), z.unknown()).default({})
  })
  .strict();

const MessagePart = z.union([
  z.object({ text: z.string().min(1).max(2_000) }).strict(),
  z.object({ data: z.record(z.string(), z.unknown()) }).strict()
]);

const SendMessageParams = z
  .object({
    message: z
      .object({
        messageId: z.string().min(1).max(160),
        role: z.literal("ROLE_USER"),
        parts: z.array(MessagePart).min(1).max(8),
        taskId: z.string().optional(),
        contextId: z.string().optional()
      })
      .strict(),
    configuration: z
      .object({
        acceptedOutputModes: z.array(z.string()).max(8).optional(),
        historyLength: z.number().int().min(0).optional(),
        blocking: z.boolean().optional(),
        returnImmediately: z.boolean().optional()
      })
      .strict()
      .optional()
  })
  .strict();

const TaskParams = z.object({ id: z.string().min(1).max(160) }).strict();

interface StoredTaskPayload extends Record<string, unknown> {
  summary?: string;
  quoteId?: string;
  artifact?: A2ATask["artifacts"] extends Array<infer Artifact> ? Artifact : never;
}

function rpcSuccess<T>(id: string | number, result: T): JsonRpcSuccess<T> {
  return { jsonrpc: "2.0", id, result };
}

function rpcFailure(
  id: string | number | null,
  code: number,
  message: string,
  reason?: string,
  metadata?: Record<string, string>
): JsonRpcFailure {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(reason
        ? {
            data: [
              {
                "@type": "type.googleapis.com/google.rpc.ErrorInfo",
                reason,
                domain: "a2a-protocol.org",
                ...(metadata ? { metadata } : {})
              }
            ]
          }
        : {})
    }
  };
}

function taskState(state: string): A2ATaskState {
  if (state === "cancelled") return "TASK_STATE_CANCELED";
  if (state === "paid") return "TASK_STATE_COMPLETED";
  if (state === "failed") return "TASK_STATE_FAILED";
  if (state === "searching") return "TASK_STATE_WORKING";
  if (["quote_ready", "budget_conflict", "itinerary_approved", "held"].includes(state)) {
    return "TASK_STATE_INPUT_REQUIRED";
  }
  return "TASK_STATE_SUBMITTED";
}

function toA2ATask(record: TaskRecord): A2ATask {
  const payload = record.request as StoredTaskPayload;
  const state = taskState(record.state);
  const message =
    state === "TASK_STATE_INPUT_REQUIRED"
      ? payload.summary ?? "Review the prepared booking before any hold or payment action."
      : state === "TASK_STATE_CANCELED"
        ? "The booking task was canceled before any seat hold."
        : undefined;

  return {
    id: record.id,
    contextId: record.contextId,
    status: {
      state,
      timestamp: record.updatedAt,
      ...(message
        ? {
            message: {
              messageId: `status-${record.id}`,
              role: "ROLE_AGENT" as const,
              parts: [{ text: message }]
            }
          }
        : {})
    },
    ...(payload.artifact ? { artifacts: [payload.artifact] } : {})
  };
}

function textFromParts(parts: z.infer<typeof MessagePart>[]): string {
  const text = parts.flatMap((part) => ("text" in part ? [part.text] : [])).join("\n");
  if (text) return text;
  const data = parts.find((part) => "data" in part);
  return data && "data" in data ? JSON.stringify(data.data) : "";
}

function versionError(id: string | number) {
  return rpcFailure(
    id,
    -32009,
    "Protocol version not supported",
    "VERSION_NOT_SUPPORTED",
    { supportedVersions: "1.0" }
  );
}

function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(paise / 100);
}

export function agentCardResponse(context: Context<AppContext>): Response {
  if (context.req.header("if-none-match") === AGENT_CARD_ETAG) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: AGENT_CARD_ETAG,
        "Cache-Control": "public, max-age=3600"
      }
    });
  }
  const origin = new URL(context.req.url).origin;
  return context.json(createAgentCard(origin), 200, {
    ETag: AGENT_CARD_ETAG,
    "Cache-Control": "public, max-age=3600"
  });
}

export const a2aRoutes = new Hono<AppContext>();

a2aRoutes.post("/", async (context) => {
  let raw: unknown;
  try {
    raw = await context.req.json();
  } catch {
    return context.json(rpcFailure(null, -32700, "Invalid JSON payload"), 400);
  }

  const request = RpcRequest.safeParse(raw);
  if (!request.success) {
    const id = raw && typeof raw === "object" && "id" in raw ? (raw as { id: unknown }).id : null;
    return context.json(
      rpcFailure(typeof id === "string" || typeof id === "number" ? id : null, -32600, "Request payload validation error"),
      400
    );
  }
  const { id, method, params } = request.data;
  const version = context.req.header("A2A-Version") || "0.3";
  if (version !== "1.0") return context.json(versionError(id), 400);

  const repository = new D1BookingRepository(context.env.DB);

  if (method === "SendMessage") {
    const parsed = SendMessageParams.safeParse(params);
    if (!parsed.success) {
      return context.json(rpcFailure(id, -32602, "Invalid parameters"), 400);
    }
    if (parsed.data.message.taskId) {
      return context.json(
        rpcFailure(id, -32004, "Continuing an existing booking task is not supported", "UNSUPPORTED_OPERATION"),
        400
      );
    }
    const clientKey =
      context.req.header("cf-connecting-ip") ??
      context.req.header("x-forwarded-for") ??
      "anonymous-a2a-client";
    if (
      !(await enforceRateLimit(
        context.env.QUOTE_RATE_LIMITER,
        clientKey,
        "/a2a/v1/SendMessage"
      ))
    ) {
      return context.json(
        rpcFailure(id, -32029, "Too many quote requests", "RATE_LIMITED"),
        429
      );
    }

    const createdAt = new Date().toISOString();
    const task: TaskRecord = {
      id: crypto.randomUUID(),
      contextId: parsed.data.message.contextId ?? crypto.randomUUID(),
      state: "searching",
      request: { messageId: parsed.data.message.messageId },
      createdAt,
      updatedAt: createdAt
    };
    await repository.createTask(task);

    try {
      const model = context.env.AI
        ? createWorkersAiModel(context.env.AI, context.env.AI_MODEL)
        : undefined;
      const tools = new BookingTools({ repository, model });
      const result = await tools.quoteBundle({
        taskId: task.id,
        text: textFromParts(parsed.data.message.parts)
      });
      const summary =
        result.policy.status === "budget_conflict"
          ? `The proposed bundle is ${formatInr(result.policy.overBy)} over budget and cannot be approved.`
          : `A ${formatInr(result.quote.total)} trek bundle for ${result.quote.partySize} travellers is ready. Separate human approvals are required for the itinerary and seat hold.`;
      const artifact = {
        artifactId: `quote-${result.quote.id}`,
        name: "T-Bud trek quote",
        description: "Authoritative catalog quote prepared for human approval.",
        parts: [
          {
            data: {
              quoteId: result.quote.id,
              version: result.quote.version,
              currency: result.quote.currency,
              total: result.quote.total,
              budget: result.quote.budget,
              expiresAt: result.quote.expiresAt,
              requiresHumanApproval: true,
              policyStatus: result.policy.status,
              items: result.quote.items.map((item) => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                unitAmount: item.unitAmount,
                amount: item.amount
              }))
            }
          }
        ]
      };
      const updated: TaskRecord = {
        ...task,
        state: result.policy.status === "eligible" ? "quote_ready" : "budget_conflict",
        request: {
          messageId: parsed.data.message.messageId,
          quoteId: result.quote.id,
          summary,
          artifact
        },
        updatedAt: new Date().toISOString()
      };
      await repository.updateTask(updated);
      return context.json(rpcSuccess(id, { task: toA2ATask(updated) }));
    } catch {
      const failed = {
        ...task,
        state: "failed",
        request: { summary: "T-Bud could not prepare an eligible quote." },
        updatedAt: new Date().toISOString()
      };
      await repository.updateTask(failed);
      return context.json(rpcSuccess(id, { task: toA2ATask(failed) }));
    }
  }

  if (method === "GetTask" || method === "CancelTask") {
    const parsed = TaskParams.safeParse(params);
    if (!parsed.success) {
      return context.json(rpcFailure(id, -32602, "Invalid parameters"), 400);
    }
    const task = await repository.getTask(parsed.data.id);
    if (!task) {
      return context.json(
        rpcFailure(id, -32001, "Task not found", "TASK_NOT_FOUND", { taskId: parsed.data.id }),
        404
      );
    }

    if (method === "GetTask") return context.json(rpcSuccess(id, toA2ATask(task)));
    if (["cancelled", "paid", "failed"].includes(task.state)) {
      return context.json(
        rpcFailure(id, -32002, "Task is not cancelable", "TASK_NOT_CANCELABLE", { taskId: task.id }),
        400
      );
    }
    const cancelled = { ...task, state: "cancelled", updatedAt: new Date().toISOString() };
    await repository.updateTask(cancelled);
    await repository.appendAudit({
      id: crypto.randomUUID(),
      taskId: task.id,
      actor: "buyer_agent",
      action: "task.cancelled",
      target: task.id,
      payload: {},
      result: "accepted",
      createdAt: cancelled.updatedAt
    });
    return context.json(rpcSuccess(id, toA2ATask(cancelled)));
  }

  return context.json(rpcFailure(id, -32601, "Method not found"), 404);
});
