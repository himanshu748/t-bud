import { Hono } from "hono";
import { z } from "zod";
import { D1BookingRepository } from "../data/repository";
import { quoteDigest, type Approval } from "../domain/approval";
import { money } from "../domain/money";
import { evaluateBundle } from "../domain/policy";
import { BookingTools } from "../domain/tools";
import type { BookingRequest, Quote } from "../domain/types";
import type { Env } from "../env";
import type { HoldResult } from "../holds/DepartureHold";
import { DepartureHoldService } from "../holds/service";
import { jsonError } from "./errors";
import { enforceRateLimit, type SecurityVariables } from "./security";

type AppContext = { Bindings: Env; Variables: SecurityVariables };

const ApprovalInput = z.object({ quoteId: z.literal("quote_demo_v2") }).strict();

async function ensureDemoQuote(repository: D1BookingRepository): Promise<Quote> {
  const existing = await repository.getQuote("quote_demo_v2");
  if (existing) return existing;

  const now = new Date();
  if (!(await repository.getTask("task_demo"))) {
    await repository.createTask({
      id: "task_demo",
      contextId: "context_demo",
      state: "quote_ready",
      request: {
        location: "Manali",
        partySize: 4,
        budget: 2_000_000,
        durationDays: 2,
        durationNights: 1,
        difficulty: "moderate",
        requestedAddonCategories: ["pickup", "meals"]
      },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    });
  }

  const trek = (await repository.listActiveTreks("Manali"))[0];
  if (!trek) throw new Error("demo trek unavailable");
  const departure = (await repository.listDepartures(trek.id)).find(
    (candidate) => candidate.status === "active" && candidate.available >= 4
  );
  if (!departure) throw new Error("demo departure unavailable");
  const addons = await repository.listActiveAddons();
  const selected = ["pickup_manali", "meals_budget"].flatMap((id) => {
    const addon = addons.find((candidate) => candidate.id === id);
    return addon ? [addon] : [];
  });
  if (selected.length !== 2) throw new Error("demo add-ons unavailable");

  const request: BookingRequest = {
    location: "Manali",
    partySize: 4,
    budget: money(2_000_000),
    durationDays: 2,
    durationNights: 1,
    difficulty: "moderate",
    requestedAddonCategories: ["pickup", "meals"]
  };
  const policy = evaluateBundle(request, trek, selected);
  const quote: Quote = {
    id: "quote_demo_v2",
    taskId: "task_demo",
    version: 2,
    trekId: trek.id,
    departureId: departure.id,
    partySize: 4,
    budget: request.budget,
    currency: "INR",
    items: policy.items,
    total: policy.total,
    expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
    status: "ready"
  };
  await repository.saveQuote(quote);
  return quote;
}

export const demoRoutes = new Hono<AppContext>();

demoRoutes.post("/approve-itinerary", async (context) => {
  const input = ApprovalInput.safeParse(await context.req.json().catch(() => null));
  if (!input.success) {
    return jsonError(context, 400, "invalid_request", "A valid demo quote is required");
  }

  const repository = new D1BookingRepository(context.env.DB);
  const quote = await ensureDemoQuote(repository);
  const sessionId = context.get("sessionId");
  if (!(await enforceRateLimit(context.env.QUOTE_RATE_LIMITER, sessionId, context.req.path))) {
    await repository.appendAudit({
      id: crypto.randomUUID(),
      taskId: quote.taskId,
      actor: "system",
      action: "security.rate_limited",
      target: "approve-itinerary",
      payload: { route: context.req.path },
      result: "rejected",
      createdAt: new Date().toISOString()
    });
    return jsonError(context, 429, "rate_limited", "Too many approval attempts");
  }

  const approvedAt = new Date().toISOString();
  const approval: Approval = {
    quoteId: quote.id,
    quoteVersion: quote.version,
    actorSessionId: sessionId,
    gate: "itinerary",
    digest: await quoteDigest(quote, sessionId),
    approvedAt
  };
  await repository.saveApproval(crypto.randomUUID(), approval);
  await repository.appendAudit({
    id: crypto.randomUUID(),
    taskId: quote.taskId,
    actor: "human",
    action: "approval.itinerary_recorded",
    target: quote.id,
    payload: { quoteVersion: quote.version, total: quote.total },
    result: "accepted",
    createdAt: approvedAt
  });

  return context.json({ approvedAt });
});

demoRoutes.post("/holds", async (context) => {
  const input = ApprovalInput.safeParse(await context.req.json().catch(() => null));
  if (!input.success) {
    return jsonError(context, 400, "invalid_request", "A valid demo quote is required");
  }

  const repository = new D1BookingRepository(context.env.DB);
  const quote = await ensureDemoQuote(repository);
  const sessionId = context.get("sessionId");
  if (!(await enforceRateLimit(context.env.HOLD_RATE_LIMITER, sessionId, context.req.path))) {
    return jsonError(context, 429, "rate_limited", "Too many hold attempts");
  }
  const approval = await repository.getApproval(quote.id, "itinerary");
  const tools = new BookingTools({
    repository,
    hold: new DepartureHoldService(context.env, repository)
  });

  try {
    const result = (await tools.requestHold({
      quote,
      approval,
      sessionId
    })) as HoldResult;
    if (result.status !== "held") {
      return jsonError(
        context,
        409,
        result.status,
        result.status === "capacity_conflict"
          ? "Those seats just sold out. Review another departure."
          : "The quote expired before seats could be held."
      );
    }
    return context.json(result);
  } catch (error) {
    return jsonError(
      context,
      409,
      "hold_not_allowed",
      error instanceof Error ? error.message : "Hold could not be created"
    );
  }
});
