import { env } from "cloudflare:workers";
import { createExecutionContext, runInDurableObject } from "cloudflare:test";
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
  await expect(verified.json()).resolves.toEqual({ verified: true, bookingConfirmed: true });
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

async function readyOrder() {
  const cookie = await bootstrap();
  const { quote } = await createQuote(cookie);
  // Paid seats persist by design; give each lifecycle test its own departure.
  const departureId = `dep_test_${crypto.randomUUID()}`;
  await env.DB.prepare("INSERT INTO departures (id,trek_id,start_at,capacity,available,status) VALUES (?, 'trek_hampta', '2026-09-12T06:30:00Z',12,12,'active')").bind(departureId).run();
  await env.DB.prepare("UPDATE quotes SET departure_id = ? WHERE id = ?").bind(departureId,quote.id).run();

  for (const path of ["/api/bookings/approve-itinerary", "/api/bookings/approve-hold", "/api/tools/request_hold", "/api/bookings/approve-payment"]) {
    expect((await post(cookie, path, { quoteId: quote.id })).status).toBe(200);
  }
  const order = await (await post(cookie, "/api/payments/order", { quoteId: quote.id })).json<{orderId:string}>();
  const getReceipt = async () => (await worker.fetch(new Request(`https://t-bud.test/api/bookings/${quote.id}/receipt`, {headers:{cookie}}), env, createExecutionContext())).json<{
    task:{state:string}; departure:{id:string;available:number}; hold:{id:string}|null;
    order:{verificationStatus:string}; audit:Array<{action:string}>;
  }>();
  return { cookie, quote, order, getReceipt };
}

it("keeps purchased seats reserved after the old hold expiry, retries and receipt refresh", async () => {
  const { cookie, quote, order, getReceipt } = await readyOrder();
  const before = await getReceipt();
  const stub = env.DEPARTURE_HOLD.getByName(before.departure.id);
  const results = await Promise.all([1,2].map(() => post(cookie, "/api/payments/simulate", {orderId:order.orderId})));
  expect(results.map(r => r.status)).toEqual([200,200]);
  await env.DB.prepare("UPDATE holds SET expires_at = '2000-01-01T00:00:00Z' WHERE quote_id = ?").bind(quote.id).run();
  await runInDurableObject(stub, async (_instance, state) => {
    const stored = await state.storage.get<{bookings:Record<string,{expiresAt:string}>}>("capacity");
    for (const booking of Object.values(stored!.bookings)) booking.expiresAt = "2000-01-01T00:00:00Z";
    await state.storage.put("capacity", stored);
  });
  // Reconfiguration and releasing a former hold must never free sold seats.
  await stub.release(before.hold!.id);
  await stub.configure({capacity:12});
  const after = await getReceipt();
  expect(after.task.state).toBe("paid");
  expect(after.order.verificationStatus).toBe("verified");
  expect(after.hold).toBeNull();
  expect(after.departure.available).toBe(before.departure.available);
  expect(after.audit.filter(e => e.action === "payment.verified")).toHaveLength(1);
  expect(after.audit.filter(e => e.action === "booking.confirmed")).toHaveLength(1);
  expect(after.audit.some(e => e.action === "hold.expired")).toBe(false);
});

it("records a late payment for review when the expired seats were taken, without overselling", async () => {
  const {cookie, quote, order, getReceipt} = await readyOrder();
  const before = await getReceipt();
  const stub = env.DEPARTURE_HOLD.getByName(before.departure.id);
  await stub.release(before.hold!.id);
  await env.DB.prepare("UPDATE holds SET expires_at = '2000-01-01T00:00:00Z' WHERE quote_id = ?").bind(quote.id).run();
  const free = (await stub.getAvailability()).available;
  await stub.reserve({holdId:"other",quoteId:"other",seats:free,expiresAt:"2099-01-01T00:00:00Z"});
  await expect((await post(cookie,"/api/payments/simulate",{orderId:order.orderId})).json()).resolves.toEqual({verified:true,bookingConfirmed:false});
  const receipt = await getReceipt();
  expect(receipt.task.state).toBe("payment_review");
  expect(receipt.order.verificationStatus).toBe("verified");
  expect(receipt.departure.available).toBe(0);
  await stub.release("other");
  // Duplicate delivery preserves the recorded review outcome.
  await expect((await post(cookie,"/api/payments/simulate",{orderId:order.orderId})).json()).resolves.toEqual({verified:true,bookingConfirmed:false});
});

it("confirms a late payment when capacity is still available", async () => {
  const {cookie, order, getReceipt} = await readyOrder();
  const before = await getReceipt();
  const stub = env.DEPARTURE_HOLD.getByName(before.departure.id);
  await stub.release(before.hold!.id);
  await expect((await post(cookie,"/api/payments/simulate",{orderId:order.orderId})).json()).resolves.toEqual({verified:true,bookingConfirmed:true});
  expect((await getReceipt()).task.state).toBe("paid");
  expect((await stub.getAvailability()).available).toBe(before.departure.available);
});

it("repairs legacy verified receipts whose temporary hold had already expired", async () => {
  const {quote,order,getReceipt} = await readyOrder();
  const before = await getReceipt();
  await env.DB.prepare("UPDATE orders SET payment_id = 'pay_legacy', verification_status = 'verified' WHERE razorpay_order_id = ?").bind(order.orderId).run();
  await env.DB.prepare("UPDATE holds SET status = 'expired', expires_at = '2000-01-01T00:00:00Z' WHERE quote_id = ?").bind(quote.id).run();
  await env.DEPARTURE_HOLD.getByName(before.departure.id).release(before.hold!.id);
  const repaired = await getReceipt();
  expect(repaired.task.state).toBe("paid");
  expect(repaired.departure.available).toBe(before.departure.available);
  expect(repaired.audit.filter(e => e.action === "booking.confirmed")).toHaveLength(1);
});

async function capturedWebhook(orderId: string, amount: number, eventId: string) {
  const secret = "isolated-webhook-test-secret";
  const body = JSON.stringify({ event: "payment.captured", created_at: Math.floor(Date.now() / 1000), payload: { payment: { entity: { id: "pay_webhook_only", order_id: orderId, status: "captured", amount, currency: "INR" } } } });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return worker.fetch(new Request("https://t-bud.test/api/payments/webhook", {
    method: "POST", headers: { "content-type": "application/json", "x-razorpay-signature": signature, "x-razorpay-event-id": eventId }, body
  }), { ...env, RAZORPAY_WEBHOOK_SECRET: secret }, createExecutionContext());
}

it("settles from a signed captured webhook when the browser never verifies, and handles retries once", async () => {
  const { order, quote, getReceipt } = await readyOrder();
  const before = await getReceipt();
  const eventId = `evt_${crypto.randomUUID()}`;
  expect((await capturedWebhook(order.orderId, quote.total, eventId)).status).toBe(200);
  expect((await capturedWebhook(order.orderId, quote.total, eventId)).status).toBe(200);
  const receipt = await getReceipt();
  expect(receipt.task.state).toBe("paid");
  expect(receipt.departure.available).toBe(before.departure.available);
  expect(receipt.audit.filter(e => e.action === "payment.verified")).toHaveLength(1);
  expect(receipt.audit.filter(e => e.action === "booking.confirmed")).toHaveLength(1);
});

it("rejects even a signed captured webhook when the amount does not match", async () => {
  const { order, quote, getReceipt } = await readyOrder();
  expect((await capturedWebhook(order.orderId, quote.total - 100, `evt_${crypto.randomUUID()}`)).status).toBe(409);
  expect((await getReceipt()).order.verificationStatus).not.toBe("verified");
});
