import { Hono } from "hono";
import { z } from "zod";
import { D1BookingRepository } from "../data/repository";
import {
  approvalMatches,
  quoteDigest,
  type Approval
} from "../domain/approval";
import type { Env } from "../env";
import { completeOrder } from "../razorpay/routes";
import { jsonError } from "./errors";
import { enforceRateLimit, type SecurityVariables } from "./security";

type AppContext = { Bindings: Env; Variables: SecurityVariables };

const QuoteApprovalInput = z
  .object({ quoteId: z.string().min(1).max(160) })
  .strict();

export const bookingRoutes = new Hono<AppContext>();

bookingRoutes.get("/:quoteId/receipt", async (context) => {
  const quoteId = context.req.param("quoteId");
  const repository = new D1BookingRepository(context.env.DB);
  const quote = await repository.getQuote(quoteId);
  if (!quote) {
    return jsonError(context, 404, "quote_not_found", "Quote not found");
  }

  // Repair pre-fix verified receipts on read using their stored server proof.
  // New bookings have an atomic settlement already, so this is a no-op for them.
  const priorOrder = await repository.getOrderByQuote(quote.id);
  if (priorOrder?.verificationStatus === "verified" && priorOrder.paymentId &&
      !(await repository.getPaymentSettlement(quote.id))) {
    await completeOrder(context.env, repository, priorOrder.razorpayOrderId, priorOrder.paymentId, "reconciliation");
  }

  const [
    task,
    departures,
    itineraryApproval,
    holdApproval,
    paymentApproval,
    storedHold,
    order,
    audit
  ] = await Promise.all([
      repository.getTask(quote.taskId),
      repository.listDepartures(quote.trekId),
      repository.getApproval(quote.id, "itinerary"),
      repository.getApproval(quote.id, "hold"),
      repository.getApproval(quote.id, "payment"),
      repository.getActiveHoldByQuote(quote.id),
      repository.getOrderByQuote(quote.id),
      repository.listAudit(quote.taskId)
    ]);
  const departure = departures.find((candidate) => candidate.id === quote.departureId);
  if (!task || !departure) {
    return jsonError(
      context,
      409,
      "receipt_unavailable",
      "The booking receipt could not be verified against merchant inventory."
    );
  }

  const stub = context.env.DEPARTURE_HOLD.getByName(departure.id);
  await stub.configure({ capacity: departure.capacity });
  const liveCapacity = await stub.getAvailability();
  let effectiveTask = task;
  let effectiveHold = storedHold;
  if (storedHold && Date.parse(storedHold.expiresAt) <= Date.now()) {
    await repository.expireUnpaidHold(storedHold, quote.taskId);
    effectiveTask = (await repository.getTask(quote.taskId))!;
    effectiveHold = await repository.getActiveHoldByQuote(quote.id);
    audit.splice(0, audit.length, ...await repository.listAudit(quote.taskId));
  }
  const approvalReceipt = (approval: Approval | null) =>
    approval
      ? {
          approvedAt: approval.approvedAt,
          receiptId: (approval.recordId ?? approval.digest)
            .replaceAll("-", "")
            .slice(0, 16)
        }
      : null;

  return context.json({
    quote: {
      id: quote.id,
      taskId: quote.taskId,
      version: quote.version,
      total: quote.total,
      budget: quote.budget,
      expiresAt: quote.expiresAt,
      departureId: quote.departureId,
      partySize: quote.partySize,
      items: quote.items
    },
    task: { state: effectiveTask.state, updatedAt: effectiveTask.updatedAt },
    departure: {
      id: departure.id,
      startAt: departure.startAt,
      capacity: liveCapacity.capacity,
      available: liveCapacity.available
    },
    approvals: {
      itinerary: approvalReceipt(itineraryApproval),
      hold: approvalReceipt(holdApproval),
      payment: approvalReceipt(paymentApproval)
    },
    order: order
      ? {
          razorpayOrderId: order.razorpayOrderId,
          amount: order.amount,
          paymentId: order.paymentId,
          verificationStatus: order.verificationStatus,
          simulated: order.razorpayOrderId.startsWith("order_sim_")
        }
      : null,
    hold: effectiveHold
      ? {
          id: effectiveHold.id,
          status: effectiveHold.status,
          expiresAt: effectiveHold.expiresAt,
          partySize: effectiveHold.partySize
        }
      : null,
    audit: audit.map((event) => ({
      id: event.id,
      actor: event.actor,
      action: event.action,
      target: event.target,
      result: event.result,
      createdAt: event.createdAt
    })),
    verifiedAt: new Date().toISOString()
  });
});

bookingRoutes.post("/approve-itinerary", async (context) => {
  const input = QuoteApprovalInput.safeParse(
    await context.req.json().catch(() => null)
  );
  if (!input.success) {
    return jsonError(context, 400, "invalid_request", "A valid quote is required");
  }

  const repository = new D1BookingRepository(context.env.DB);
  const quote = await repository.getQuote(input.data.quoteId);
  if (!quote) {
    return jsonError(context, 404, "quote_not_found", "Quote not found");
  }
  if (quote.total > quote.budget) {
    return jsonError(
      context,
      409,
      "budget_conflict",
      "This quote exceeds the hard budget ceiling. Change the request and prepare a new quote."
    );
  }
  if (quote.status !== "ready") {
    return jsonError(
      context,
      409,
      "quote_not_approvable",
      "This quote is not eligible for approval. Prepare a new quote."
    );
  }
  if (Date.parse(quote.expiresAt) <= Date.now()) {
    return jsonError(
      context,
      409,
      "quote_expired",
      "This quote expired. Prepare a new quote before approving it."
    );
  }

  const sessionId = context.get("sessionId");
  if (
    !(await enforceRateLimit(
      context.env.QUOTE_RATE_LIMITER,
      sessionId,
      context.req.path
    ))
  ) {
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
  const task = await repository.getTask(quote.taskId);
  if (task) {
    await repository.updateTask({
      ...task,
      state: "itinerary_approved",
      updatedAt: approvedAt
    });
  }

  return context.json({ approvedAt });
});

bookingRoutes.post("/approve-payment", async (context) => {
  const input = QuoteApprovalInput.safeParse(
    await context.req.json().catch(() => null)
  );
  if (!input.success) {
    return jsonError(context, 400, "invalid_request", "A valid quote is required");
  }

  const repository = new D1BookingRepository(context.env.DB);
  const quote = await repository.getQuote(input.data.quoteId);
  if (!quote) {
    return jsonError(context, 404, "quote_not_found", "Quote not found");
  }
  if (quote.total > quote.budget) {
    return jsonError(
      context,
      409,
      "budget_conflict",
      "This quote exceeds the hard budget ceiling. Change the request and prepare a new quote."
    );
  }

  const sessionId = context.get("sessionId");
  if (
    !(await enforceRateLimit(
      context.env.CHECKOUT_RATE_LIMITER,
      sessionId,
      context.req.path
    ))
  ) {
    await repository.appendAudit({
      id: crypto.randomUUID(),
      taskId: quote.taskId,
      actor: "system",
      action: "security.rate_limited",
      target: "approve-payment",
      payload: { route: context.req.path },
      result: "rejected",
      createdAt: new Date().toISOString()
    });
    return jsonError(context, 429, "rate_limited", "Too many approval attempts");
  }

  const holdApproval = await repository.getApproval(quote.id, "hold");
  if (!holdApproval || !(await approvalMatches(holdApproval, quote, sessionId))) {
    return jsonError(
      context,
      409,
      "hold_approval_required",
      "Approve and place the seat hold before authorizing payment."
    );
  }

  const hold = await repository.getActiveHoldByQuote(quote.id);
  if (!hold || hold.status !== "held" || Date.parse(hold.expiresAt) <= Date.now()) {
    return jsonError(
      context,
      409,
      "hold_required",
      "An active seat hold is required before payment can be authorized."
    );
  }

  const approvedAt = new Date().toISOString();
  const approval: Approval = {
    quoteId: quote.id,
    quoteVersion: quote.version,
    actorSessionId: sessionId,
    gate: "payment",
    digest: await quoteDigest(quote, sessionId),
    approvedAt
  };
  await repository.saveApproval(crypto.randomUUID(), approval);
  await repository.appendAudit({
    id: crypto.randomUUID(),
    taskId: quote.taskId,
    actor: "human",
    action: "approval.payment_recorded",
    target: quote.id,
    payload: { quoteVersion: quote.version, total: quote.total },
    result: "accepted",
    createdAt: approvedAt
  });

  return context.json({ approvedAt });
});

bookingRoutes.post("/approve-hold", async (context) => {
  const input = QuoteApprovalInput.safeParse(
    await context.req.json().catch(() => null)
  );
  if (!input.success) {
    return jsonError(context, 400, "invalid_request", "A valid quote is required");
  }

  const repository = new D1BookingRepository(context.env.DB);
  const quote = await repository.getQuote(input.data.quoteId);
  if (!quote) {
    return jsonError(context, 404, "quote_not_found", "Quote not found");
  }
  if (quote.total > quote.budget) {
    return jsonError(
      context,
      409,
      "budget_conflict",
      "This quote exceeds the hard budget ceiling. Change the request and prepare a new quote."
    );
  }
  if (quote.status !== "ready" || Date.parse(quote.expiresAt) <= Date.now()) {
    return jsonError(
      context,
      409,
      "quote_not_approvable",
      "This quote is no longer eligible for a seat hold. Prepare a new quote."
    );
  }

  const sessionId = context.get("sessionId");
  if (
    !(await enforceRateLimit(
      context.env.HOLD_RATE_LIMITER,
      sessionId,
      context.req.path
    ))
  ) {
    await repository.appendAudit({
      id: crypto.randomUUID(),
      taskId: quote.taskId,
      actor: "system",
      action: "security.rate_limited",
      target: "approve-hold",
      payload: { route: context.req.path },
      result: "rejected",
      createdAt: new Date().toISOString()
    });
    return jsonError(context, 429, "rate_limited", "Too many approval attempts");
  }

  const itineraryApproval = await repository.getApproval(quote.id, "itinerary");
  if (
    !itineraryApproval ||
    !(await approvalMatches(itineraryApproval, quote, sessionId))
  ) {
    return jsonError(
      context,
      409,
      "itinerary_approval_required",
      "Approve this exact itinerary before authorizing a seat hold."
    );
  }

  const approvedAt = new Date().toISOString();
  const approval: Approval = {
    quoteId: quote.id,
    quoteVersion: quote.version,
    actorSessionId: sessionId,
    gate: "hold",
    digest: await quoteDigest(quote, sessionId),
    approvedAt
  };
  await repository.saveApproval(crypto.randomUUID(), approval);
  await repository.appendAudit({
    id: crypto.randomUUID(),
    taskId: quote.taskId,
    actor: "human",
    action: "approval.hold_recorded",
    target: quote.id,
    payload: { quoteVersion: quote.version, partySize: quote.partySize },
    result: "accepted",
    createdAt: approvedAt
  });

  return context.json({ approvedAt });
});
