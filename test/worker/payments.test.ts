import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import worker from "../../worker";

const intent =
  "2-day Manali trek for 4 people under ₹20,000 with pickup and upgraded meals for occasional hikers";

async function bootstrap() {
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

async function createQuote(cookie: string) {
  const response = await post(cookie, "/api/tools/quote_bundle", { text: intent });
  expect(response.status).toBe(200);
  return response.json<{ quote: { id: string; total: number } }>();
}

it("refuses to create a Razorpay order without a human payment approval", async () => {
  const cookie = await bootstrap();
  const { quote } = await createQuote(cookie);

  for (const path of ["/api/payments/order", "/api/tools/create_checkout"]) {
    const response = await post(cookie, path, { quoteId: quote.id });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "checkout_not_allowed" }
    });
  }
});

it("refuses to approve payment before the seats are actually held", async () => {
  const cookie = await bootstrap();
  const { quote } = await createQuote(cookie);

  const noItinerary = await post(cookie, "/api/bookings/approve-payment", {
    quoteId: quote.id
  });
  expect(noItinerary.status).toBe(409);
  await expect(noItinerary.json()).resolves.toMatchObject({
    error: { code: "hold_approval_required" }
  });

  expect(
    (await post(cookie, "/api/bookings/approve-itinerary", { quoteId: quote.id }))
      .status
  ).toBe(200);
  expect(
    (await post(cookie, "/api/bookings/approve-hold", { quoteId: quote.id })).status
  ).toBe(200);

  const noHold = await post(cookie, "/api/bookings/approve-payment", {
    quoteId: quote.id
  });
  expect(noHold.status).toBe(409);
  await expect(noHold.json()).resolves.toMatchObject({
    error: { code: "hold_required" }
  });
});

it("creates a simulated Razorpay order once the human gate is recorded", async () => {
  const cookie = await bootstrap();
  const { quote } = await createQuote(cookie);

  await post(cookie, "/api/bookings/approve-itinerary", { quoteId: quote.id });
  await post(cookie, "/api/bookings/approve-hold", { quoteId: quote.id });
  expect(
    (await post(cookie, "/api/tools/request_hold", { quoteId: quote.id })).status
  ).toBe(200);
  expect(
    (await post(cookie, "/api/bookings/approve-payment", { quoteId: quote.id }))
      .status
  ).toBe(200);

  const order = await post(cookie, "/api/payments/order", { quoteId: quote.id });
  expect(order.status).toBe(200);
  const body = await order.json<{
    orderId: string;
    amount: number;
    currency: string;
    simulated: boolean;
  }>();
  expect(body.simulated).toBe(true);
  expect(body.orderId).toMatch(/^order_sim_/);
  expect(body.amount).toBe(quote.total);
  expect(body.currency).toBe("INR");

  const verified = await post(cookie, "/api/payments/simulate", {
    orderId: body.orderId
  });
  expect(verified.status).toBe(200);
  await expect(verified.json()).resolves.toEqual({ verified: true });
});

it("rejects a webhook that carries no valid signature", async () => {
  const response = await worker.fetch(
    new Request("https://t-bud.test/api/payments/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": "not-a-signature",
        "x-razorpay-event-id": "evt_forged"
      },
      body: JSON.stringify({ event: "payment.captured", created_at: 0 })
    }),
    env,
    createExecutionContext()
  );

  expect(response.status).toBe(403);
  await expect(response.json()).resolves.toMatchObject({
    error: { code: "signature_invalid" }
  });
});
