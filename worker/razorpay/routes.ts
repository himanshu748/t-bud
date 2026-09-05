import { Hono } from "hono";
import { z } from "zod";
import { D1BookingRepository } from "../data/repository";
import { approvalMatches } from "../domain/approval";
import { BookingTools } from "../domain/tools";
import type { Env } from "../env";
import { jsonError } from "../http/errors";
import { enforceRateLimit, type SecurityVariables } from "../http/security";
import { verifyPaymentSignature, verifyWebhookSignature } from "./signature";
import { HttpRazorpayGateway } from "./client";
import { gatewayForEnv, RazorpayCheckoutService } from "./service";

type AppContext = { Bindings: Env; Variables: SecurityVariables };

const QuoteInput = z.object({ quoteId: z.string().min(1).max(160) }).strict();
const VerificationInput = z
  .object({
    razorpay_order_id: z.string().min(1).max(160),
    razorpay_payment_id: z.string().min(1).max(160),
    razorpay_signature: z.string().min(1).max(256)
  })
  .strict();
const SimulationInput = z
  .object({ orderId: z.string().min(1).max(160) })
  .strict();
const CapturedWebhook = z
  .object({
    event: z.string().min(1),
    created_at: z.number().int(),
    payload: z
      .object({
        payment: z.object({
          entity: z.object({
            id: z.string().min(1),
            order_id: z.string().min(1),
            status: z.string(),
            amount: z.number().int().nonnegative(),
            currency: z.string()
          })
        })
      })
      .optional()
  })
  .passthrough();

export async function completeOrder(
  env: Env,
  repository: D1BookingRepository,
  razorpayOrderId: string,
  paymentId: string,
  source: "checkout" | "webhook" | "simulation" | "reconciliation"
): Promise<boolean> {
  const order = await repository.getOrderByGatewayId(razorpayOrderId);
  if (!order) throw new Error("order not found");
  const settled = await repository.getPaymentSettlement(order.quoteId);
  if (settled) return settled.status === "confirmed";
  const quote = await repository.getQuote(order.quoteId);
  if (!quote) throw new Error("quote not found");
  const hold = await repository.getLatestHoldByQuote(quote.id);
  if (!hold) throw new Error("payment has no booking hold");
  const departure = (await repository.listDepartures(quote.trekId)).find(d => d.id === quote.departureId);
  if (!departure) throw new Error("departure not found");
  const stub = env.DEPARTURE_HOLD.getByName(quote.departureId);
  await stub.configure({ capacity: departure.capacity });
  const { confirmed } = await stub.confirm({
    holdId: hold.id, quoteId: quote.id, seats: quote.partySize, expiresAt: hold.expiresAt
  });
  await repository.settlePayment({ quote, hold, order, paymentId, confirmed, source });
  return confirmed;
}

export const paymentRoutes = new Hono<AppContext>();

paymentRoutes.post("/order", async (context) => {
  const input = QuoteInput.safeParse(await context.req.json().catch(() => null));
  if (!input.success) {
    return jsonError(context, 400, "invalid_request", "A quote is required");
  }
  const sessionId = context.get("sessionId");
  if (!(await enforceRateLimit(context.env.CHECKOUT_RATE_LIMITER, sessionId, context.req.path))) {
    return jsonError(context, 429, "rate_limited", "Too many checkout attempts");
  }

  const repository = new D1BookingRepository(context.env.DB);
  const quote = await repository.getQuote(input.data.quoteId);
  if (!quote) return jsonError(context, 404, "quote_not_found", "Quote not found");
  const approval = await repository.getApproval(quote.id, "payment");
  const tools = new BookingTools({
    repository,
    checkout: new RazorpayCheckoutService(repository, gatewayForEnv(context.env))
  });
  try {
    const checkout = (await tools.createCheckout({
      quote,
      approval,
      sessionId
    })) as {
      orderId: string;
      amount: number;
      currency: "INR";
      simulated: boolean;
    };
    return context.json({
      ...checkout,
      keyId: checkout.simulated
        ? "rzp_test_simulated"
        : context.env.RAZORPAY_KEY_ID!
    });
  } catch (error) {
    return jsonError(
      context,
      409,
      "checkout_not_allowed",
      error instanceof Error ? error.message : "Checkout could not be created"
    );
  }
});

paymentRoutes.post("/verify", async (context) => {
  const input = VerificationInput.safeParse(await context.req.json().catch(() => null));
  if (!input.success) {
    return jsonError(context, 400, "invalid_request", "Payment proof is invalid");
  }
  const repository = new D1BookingRepository(context.env.DB);
  const order = await repository.getOrderByGatewayId(input.data.razorpay_order_id);
  if (!order || !context.env.RAZORPAY_KEY_SECRET) {
    return jsonError(context, 403, "signature_invalid", "Payment signature could not be verified");
  }
  const verified = await verifyPaymentSignature(
    {
      orderId: order.razorpayOrderId,
      paymentId: input.data.razorpay_payment_id,
      signature: input.data.razorpay_signature
    },
    context.env.RAZORPAY_KEY_SECRET
  );
  if (!verified) {
    return jsonError(context, 403, "signature_invalid", "Payment signature could not be verified");
  }
  try {
    await new HttpRazorpayGateway({keyId:context.env.RAZORPAY_KEY_ID!, keySecret:context.env.RAZORPAY_KEY_SECRET})
      .ensureCaptured({paymentId:input.data.razorpay_payment_id, orderId:order.razorpayOrderId, amount:order.amount});
  } catch (error) {
    return jsonError(context, 409, "payment_not_captured", error instanceof Error ? error.message : "Retry payment verification");
  }
  const bookingConfirmed = await completeOrder(
    context.env,
    repository,
    order.razorpayOrderId,
    input.data.razorpay_payment_id,
    "checkout"
  );
  return context.json({ verified: true, bookingConfirmed });
});

paymentRoutes.post("/simulate", async (context) => {
  if (context.env.RAZORPAY_KEY_ID || context.env.RAZORPAY_KEY_SECRET) {
    return jsonError(context, 403, "simulation_disabled", "Simulation is disabled");
  }
  const input = SimulationInput.safeParse(await context.req.json().catch(() => null));
  if (!input.success) {
    return jsonError(context, 400, "invalid_request", "A simulated order is required");
  }
  const repository = new D1BookingRepository(context.env.DB);
  const order = await repository.getOrderByGatewayId(input.data.orderId);
  if (!order || !order.razorpayOrderId.startsWith("order_sim_")) {
    return jsonError(context, 404, "order_not_found", "Simulated order not found");
  }
  const quote = await repository.getQuote(order.quoteId);
  if (!quote) return jsonError(context, 404, "quote_not_found", "Quote not found");
  const approval = await repository.getApproval(quote.id, "payment");
  if (!approval || !(await approvalMatches(approval, quote, context.get("sessionId")))) {
    return jsonError(context, 403, "approval_required", "Payment approval is required");
  }
  const bookingConfirmed = await completeOrder(
    context.env,
    repository,
    order.razorpayOrderId,
    "pay_simulated",
    "simulation"
  );
  return context.json({ verified: true, bookingConfirmed });
});

paymentRoutes.post("/webhook", async (context) => {
  const signature = context.req.header("x-razorpay-signature") ?? "";
  const eventId = context.req.header("x-razorpay-event-id") ?? "";
  const secret = context.env.RAZORPAY_WEBHOOK_SECRET;
  const rawBody = await context.req.text();
  if (!secret || !eventId || !(await verifyWebhookSignature(rawBody, signature, secret))) {
    return jsonError(context, 403, "signature_invalid", "Webhook signature could not be verified");
  }
  const parsedJson = (() => {
    try {
      return JSON.parse(rawBody) as unknown;
    } catch {
      return null;
    }
  })();
  const event = CapturedWebhook.safeParse(parsedJson);
  if (!event.success) {
    return jsonError(context, 400, "invalid_request", "Webhook payload is invalid");
  }
  const age = Date.now() - event.data.created_at * 1_000;
  if (age < -5 * 60_000) {
    return jsonError(context, 409, "stale_webhook", "Webhook timestamp is outside the accepted window");
  }
  if (event.data.event !== "payment.captured" || !event.data.payload) {
    return context.json({ accepted: true });
  }

  const payment = event.data.payload.payment.entity;
  const repository = new D1BookingRepository(context.env.DB);
  const order = await repository.getOrderByGatewayId(payment.order_id);
  if (!order) return context.json({ accepted: true });
  if (payment.status !== "captured" || payment.amount !== order.amount || payment.currency !== "INR") {
    return jsonError(context, 409, "payment_mismatch", "Captured payment does not match the order");
  }
  // Acknowledge only after durable completion so Razorpay can retry failures.
  await completeOrder(context.env, repository, order.razorpayOrderId, payment.id, "webhook");
  await repository.recordPaymentEvent(eventId, event.data.event, new Date().toISOString());
  return context.json({ accepted: true });
});
