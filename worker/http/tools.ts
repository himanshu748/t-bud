import { Hono } from "hono";
import { z } from "zod";
import { createWorkersAiModel } from "../ai/recommendation";
import { D1BookingRepository, type TaskRecord } from "../data/repository";
import { BookingTools } from "../domain/tools";
import type { Env } from "../env";
import { DepartureHoldService } from "../holds/service";
import { gatewayForEnv, RazorpayCheckoutService } from "../razorpay/service";
import { jsonError } from "./errors";
import { enforceRateLimit, type SecurityVariables } from "./security";

type AppContext = { Bindings: Env; Variables: SecurityVariables };

const SearchInput = z
  .object({
    location: z.string().min(1).max(80),
    partySize: z.number().int().min(1).max(12)
  })
  .strict();

const AvailabilityInput = z
  .object({
    trekId: z.string().min(1).max(120),
    partySize: z.number().int().min(1).max(12)
  })
  .strict();

const QuoteInput = z
  .object({ text: z.string().min(1).max(2_000) })
  .strict();

const QuoteIdInput = z
  .object({ quoteId: z.string().min(1).max(160) })
  .strict();

async function parseInput<T extends z.ZodType>(context: Parameters<T["safeParse"]>[0], schema: T) {
  return schema.safeParse(context);
}

function createTools(context: {
  env: Env;
  repository: D1BookingRepository;
}) {
  const model = context.env.AI
    ? createWorkersAiModel(context.env.AI, context.env.AI_MODEL)
    : undefined;
  return new BookingTools({
    repository: context.repository,
    model,
    hold: new DepartureHoldService(context.env, context.repository),
    checkout: new RazorpayCheckoutService(
      context.repository,
      gatewayForEnv(context.env)
    )
  });
}

export const toolRoutes = new Hono<AppContext>();

toolRoutes.post("/search_treks", async (context) => {
  const input = await parseInput(
    await context.req.json().catch(() => null),
    SearchInput
  );
  if (!input.success) {
    return jsonError(context, 400, "invalid_request", "Location and party size are required");
  }

  const repository = new D1BookingRepository(context.env.DB);
  const treks = await createTools({ env: context.env, repository }).searchTreks(input.data);
  return context.json({ treks });
});

toolRoutes.post("/get_availability", async (context) => {
  const input = await parseInput(
    await context.req.json().catch(() => null),
    AvailabilityInput
  );
  if (!input.success) {
    return jsonError(context, 400, "invalid_request", "Trek and party size are required");
  }

  const repository = new D1BookingRepository(context.env.DB);
  const departures = await createTools({
    env: context.env,
    repository
  }).getAvailability(input.data);
  return context.json({ departures });
});

toolRoutes.post("/quote_bundle", async (context) => {
  const input = await parseInput(
    await context.req.json().catch(() => null),
    QuoteInput
  );
  if (!input.success) {
    return jsonError(context, 400, "invalid_request", "A booking request is required");
  }

  const sessionId = context.get("sessionId");
  if (!(await enforceRateLimit(context.env.QUOTE_RATE_LIMITER, sessionId, context.req.path))) {
    return jsonError(context, 429, "rate_limited", "Too many quote requests");
  }

  const repository = new D1BookingRepository(context.env.DB);
  const createdAt = new Date().toISOString();
  const task: TaskRecord = {
    id: crypto.randomUUID(),
    contextId: crypto.randomUUID(),
    state: "searching",
    request: { text: input.data.text, source: "webmcp" },
    createdAt,
    updatedAt: createdAt
  };
  await repository.createTask(task);

  try {
    const result = await createTools({ env: context.env, repository }).quoteBundle({
      taskId: task.id,
      text: input.data.text
    });
    await repository.updateTask({
      ...task,
      state: result.policy.status === "eligible" ? "quote_ready" : "budget_conflict",
      request: {
        text: input.data.text,
        source: "webmcp",
        quoteId: result.quote.id
      },
      updatedAt: new Date().toISOString()
    });
    return context.json(result);
  } catch {
    await repository.updateTask({
      ...task,
      state: "failed",
      updatedAt: new Date().toISOString()
    });
    return jsonError(context, 409, "quote_unavailable", "No eligible trek quote was found");
  }
});

toolRoutes.post("/request_hold", async (context) => {
  const input = await parseInput(
    await context.req.json().catch(() => null),
    QuoteIdInput
  );
  if (!input.success) {
    return jsonError(context, 400, "invalid_request", "A quote is required");
  }
  const sessionId = context.get("sessionId");
  if (!(await enforceRateLimit(context.env.HOLD_RATE_LIMITER, sessionId, context.req.path))) {
    return jsonError(context, 429, "rate_limited", "Too many hold requests");
  }

  const repository = new D1BookingRepository(context.env.DB);
  const quote = await repository.getQuote(input.data.quoteId);
  if (!quote) return jsonError(context, 404, "quote_not_found", "Quote not found");
  const approval = await repository.getApproval(quote.id, "itinerary");
  try {
    const hold = await createTools({ env: context.env, repository }).requestHold({
      quote,
      approval,
      sessionId
    });
    return context.json({ hold });
  } catch (error) {
    return jsonError(
      context,
      409,
      "hold_not_allowed",
      error instanceof Error ? error.message : "Hold could not be created"
    );
  }
});

toolRoutes.post("/create_checkout", async (context) => {
  const input = await parseInput(
    await context.req.json().catch(() => null),
    QuoteIdInput
  );
  if (!input.success) {
    return jsonError(context, 400, "invalid_request", "A quote is required");
  }
  const sessionId = context.get("sessionId");
  if (!(await enforceRateLimit(context.env.CHECKOUT_RATE_LIMITER, sessionId, context.req.path))) {
    return jsonError(context, 429, "rate_limited", "Too many checkout requests");
  }

  const repository = new D1BookingRepository(context.env.DB);
  const quote = await repository.getQuote(input.data.quoteId);
  if (!quote) return jsonError(context, 404, "quote_not_found", "Quote not found");
  const approval = await repository.getApproval(quote.id, "payment");
  try {
    const checkout = await createTools({ env: context.env, repository }).createCheckout({
      quote,
      approval,
      sessionId
    });
    return context.json({ checkout });
  } catch (error) {
    return jsonError(
      context,
      409,
      "checkout_not_allowed",
      error instanceof Error ? error.message : "Checkout could not be created"
    );
  }
});
