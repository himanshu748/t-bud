import { env } from "cloudflare:workers";
import {
  createExecutionContext,
  waitOnExecutionContext
} from "cloudflare:test";
import worker from "../../worker";

async function session() {
  const response = await worker.fetch(
    new Request("https://t-bud.test/api/health"),
    env,
    createExecutionContext()
  );
  return response.headers.get("set-cookie")!.split(";", 1)[0];
}

function post(cookie: string, path: string, body: Record<string, unknown>) {
  return worker.fetch(
    new Request(`https://t-bud.test${path}`, {
      method: "POST",
      headers: {
        origin: "https://t-bud.test",
        cookie,
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    }),
    env,
    createExecutionContext()
  );
}

async function approvedHold(cookie: string) {
  await post(cookie, "/api/demo/approve-itinerary", { quoteId: "quote_demo_v2" });
  const response = await post(cookie, "/api/demo/holds", { quoteId: "quote_demo_v2" });
  return response.json<{ holdId: string }>();
}

async function sign(raw: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const bytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(raw)
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

it("requires a second human approval and creates one idempotent order", async () => {
  const cookie = await session();
  const hold = await approvedHold(cookie);

  const blocked = await post(cookie, "/api/payments/order", {
    quoteId: "quote_demo_v2"
  });
  expect(blocked.status).toBe(409);

  const approval = await post(cookie, "/api/demo/approve-payment", {
    holdId: hold.holdId
  });
  expect(approval.status).toBe(200);

  const first = await post(cookie, "/api/payments/order", {
    quoteId: "quote_demo_v2"
  });
  const second = await post(cookie, "/api/payments/order", {
    quoteId: "quote_demo_v2"
  });
  const firstBody = await first.json<{ orderId: string; simulated: boolean }>();
  const secondBody = await second.json<{ orderId: string; simulated: boolean }>();

  expect(first.status).toBe(200);
  expect(firstBody).toMatchObject({ simulated: true, orderId: expect.any(String) });
  expect(secondBody.orderId).toBe(firstBody.orderId);
  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM orders WHERE quote_id = ?")
    .bind("quote_demo_v2")
    .first<{ count: number }>();
  expect(count?.count).toBe(1);
});

it("rejects a forged callback and processes a signed webhook once", async () => {
  const cookie = await session();
  const hold = await approvedHold(cookie);
  await post(cookie, "/api/demo/approve-payment", { holdId: hold.holdId });
  const orderResponse = await post(cookie, "/api/payments/order", {
    quoteId: "quote_demo_v2"
  });
  const order = await orderResponse.json<{ orderId: string }>();

  const forged = await post(cookie, "/api/payments/verify", {
    razorpay_order_id: order.orderId,
    razorpay_payment_id: "pay_forged",
    razorpay_signature: "00".repeat(32)
  });
  expect(forged.status).toBe(403);

  const eventId = `event-${crypto.randomUUID()}`;
  const raw = JSON.stringify({
    event: "payment.captured",
    created_at: Math.floor(Date.now() / 1000),
    payload: {
      payment: {
        entity: {
          id: "pay_webhook",
          order_id: order.orderId,
          status: "captured"
        }
      }
    }
  });
  const signature = await sign(raw, env.RAZORPAY_WEBHOOK_SECRET!);
  const sendWebhook = async () => {
    const context = createExecutionContext();
    const response = await worker.fetch(
      new Request("https://t-bud.test/api/payments/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-razorpay-event-id": eventId,
          "x-razorpay-signature": signature
        },
        body: raw
      }),
      env,
      context
    );
    await waitOnExecutionContext(context);
    return response;
  };

  expect((await sendWebhook()).status).toBe(200);
  expect((await sendWebhook()).status).toBe(200);
  const stored = await env.DB.prepare(
    "SELECT verification_status, payment_id FROM orders WHERE razorpay_order_id = ?"
  )
    .bind(order.orderId)
    .first<{ verification_status: string; payment_id: string }>();
  expect(stored).toEqual({
    verification_status: "verified",
    payment_id: "pay_webhook"
  });
  const events = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM payment_events WHERE gateway_event_id = ?"
  )
    .bind(eventId)
    .first<{ count: number }>();
  expect(events?.count).toBe(1);
});
