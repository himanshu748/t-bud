import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import worker from "../../worker";
import { hashSessionId } from "../../worker/http/security";

const intent =
  "2-day Manali trek for 4 people under ₹20,000 with pickup and upgraded meals for occasional hikers";

async function bootstrap() {
  const response = await worker.fetch(
    new Request("https://t-bud.test/api/health"),
    env,
    createExecutionContext()
  );
  const cookie = response.headers.get("set-cookie")!.split(";", 1)[0];
  const rawSession = cookie.split("=", 2)[1];
  return { cookie, rawSession };
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

function get(cookie: string, path: string) {
  return worker.fetch(
    new Request(`https://t-bud.test${path}`, {
      headers: { cookie }
    }),
    env,
    createExecutionContext()
  );
}

async function createQuote(cookie: string, text = intent) {
  const response = await post(cookie, "/api/tools/quote_bundle", { text });
  expect(response.status).toBe(200);
  return response.json<{ quote: { id: string; total: number } }>();
}

it("binds a live itinerary approval to the current browser session", async () => {
  const { cookie, rawSession } = await bootstrap();
  const { quote } = await createQuote(cookie);
  const response = await post(cookie, "/api/bookings/approve-itinerary", {
    quoteId: quote.id
  });

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    approvedAt: expect.any(String)
  });
  const approval = await env.DB.prepare(
    "SELECT actor_session_id FROM approvals WHERE quote_id = ? AND gate = 'itinerary'"
  )
    .bind(quote.id)
    .first<{ actor_session_id: string }>();
  expect(approval?.actor_session_id).toBe(await hashSessionId(rawSession));
  expect(approval?.actor_session_id).not.toBe(rawSession);
  expect(quote.total).toBe(1_960_000);
  const receipt = await get(cookie, `/api/bookings/${quote.id}/receipt`);
  await expect(receipt.json()).resolves.toMatchObject({
    task: { state: "itinerary_approved" },
    approvals: {
      itinerary: { receiptId: expect.stringMatching(/^[a-f0-9]{16}$/) }
    }
  });
});

it("returns a server receipt backed by D1 audit and live departure capacity", async () => {
  const { cookie } = await bootstrap();
  const { quote } = await createQuote(cookie);

  const response = await get(cookie, `/api/bookings/${quote.id}/receipt`);
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    quote: {
      id: quote.id,
      taskId: expect.any(String),
      version: 1,
      total: 1_960_000
    },
    task: { state: "quote_ready" },
    departure: {
      id: "dep_hampta_2026_09_12",
      startAt: "2026-09-12T06:30:00.000Z",
      capacity: 12,
      available: expect.any(Number)
    },
    approvals: { itinerary: null, hold: null, payment: null },
    hold: null,
    audit: [
      {
        action: "request.received",
        actor: "buyer_agent",
        target: expect.any(String)
      },
      {
        action: "quote.created",
        actor: "merchant_agent",
        target: quote.id
      }
    ],
    verifiedAt: expect.any(String)
  });
});

it("holds live inventory only after two current-session approvals", async () => {
  const { cookie } = await bootstrap();
  const { quote } = await createQuote(cookie);

  const blocked = await post(cookie, "/api/tools/request_hold", {
    quoteId: quote.id
  });
  expect(blocked.status).toBe(409);

  const approval = await post(cookie, "/api/bookings/approve-itinerary", {
    quoteId: quote.id
  });
  expect(approval.status).toBe(200);

  const stillBlocked = await post(cookie, "/api/tools/request_hold", {
    quoteId: quote.id
  });
  expect(stillBlocked.status).toBe(409);

  const holdApproval = await post(cookie, "/api/bookings/approve-hold", {
    quoteId: quote.id
  });
  expect(holdApproval.status).toBe(200);
  const held = await post(cookie, "/api/tools/request_hold", {
    quoteId: quote.id
  });
  expect(held.status).toBe(200);
  const heldBody = await held.json<{
    hold: { status: string; holdId: string; expiresAt: string };
  }>();
  expect(heldBody).toMatchObject({
    hold: {
      status: "held",
      holdId: expect.any(String),
      expiresAt: expect.any(String)
    }
  });
  await env.DEPARTURE_HOLD.getByName("dep_hampta_2026_09_12").release(
    heldBody.hold.holdId
  );
});

it("advances the server receipt after both approvals and the atomic hold", async () => {
  const { cookie } = await bootstrap();
  const { quote } = await createQuote(cookie);
  expect(
    (await post(cookie, "/api/bookings/approve-itinerary", { quoteId: quote.id }))
      .status
  ).toBe(200);
  expect(
    (await post(cookie, "/api/bookings/approve-hold", { quoteId: quote.id })).status
  ).toBe(200);
  expect(
    (await post(cookie, "/api/tools/request_hold", { quoteId: quote.id })).status
  ).toBe(200);

  const response = await get(cookie, `/api/bookings/${quote.id}/receipt`);
  expect(response.status).toBe(200);
  const receipt = await response.json() as {
    approvals: {
      itinerary: { receiptId: string };
      hold: { receiptId: string };
    };
  };
  expect(receipt).toMatchObject({
    task: { state: "held" },
    departure: { available: 8 },
    approvals: {
      itinerary: {
        approvedAt: expect.any(String),
        receiptId: expect.stringMatching(/^[a-f0-9]{16}$/)
      },
      hold: {
        approvedAt: expect.any(String),
        receiptId: expect.stringMatching(/^[a-f0-9]{16}$/)
      }
    },
    hold: {
      id: expect.any(String),
      status: "held",
      partySize: 4,
      expiresAt: expect.any(String)
    },
    audit: expect.arrayContaining([
      expect.objectContaining({
        action: "approval.itinerary_recorded",
        actor: "human"
      }),
      expect.objectContaining({ action: "approval.hold_recorded", actor: "human" }),
      expect.objectContaining({ action: "hold.created", actor: "merchant_agent" })
    ])
  });
  expect(receipt.approvals.itinerary.receiptId).not.toBe(
    receipt.approvals.hold.receiptId
  );
  const heldRecord = await env.DB.prepare(
    "SELECT id FROM holds WHERE quote_id = ?"
  )
    .bind(quote.id)
    .first<{ id: string }>();
  if (heldRecord) {
    await env.DEPARTURE_HOLD.getByName("dep_hampta_2026_09_12").release(
      heldRecord.id
    );
    await env.DB.prepare(
      "UPDATE holds SET expires_at = ?, status = 'held' WHERE id = ?"
    )
      .bind("2020-01-01T00:00:00.000Z", heldRecord.id)
      .run();

    const expiredResponse = await get(
      cookie,
      `/api/bookings/${quote.id}/receipt`
    );
    expect(expiredResponse.status).toBe(200);
    await expect(expiredResponse.json()).resolves.toMatchObject({
      task: { state: "hold_expired" },
      departure: { available: 12 },
      hold: null,
      audit: expect.arrayContaining([
        expect.objectContaining({
          action: "hold.expired",
          actor: "system",
          result: "recorded"
        })
      ])
    });
    const expiredHold = await env.DB.prepare(
      "SELECT status FROM holds WHERE id = ?"
    )
      .bind(heldRecord.id)
      .first<{ status: string }>();
    expect(expiredHold?.status).toBe("expired");
  }
});

it("enforces the hard budget ceiling at every consequential route", async () => {
  const { cookie } = await bootstrap();
  const { quote } = await createQuote(
    cookie,
    "2-day Manali trek for 4 people under ₹19,000 with pickup and upgraded meals"
  );
  expect(quote.total).toBe(1_960_000);

  const itineraryApproval = await post(
    cookie,
    "/api/bookings/approve-itinerary",
    { quoteId: quote.id }
  );
  expect(itineraryApproval.status).toBe(409);
  await expect(itineraryApproval.json()).resolves.toMatchObject({
    error: { code: "budget_conflict" }
  });

  const holdApproval = await post(cookie, "/api/bookings/approve-hold", {
    quoteId: quote.id
  });
  expect(holdApproval.status).toBe(409);

  const hold = await post(cookie, "/api/tools/request_hold", {
    quoteId: quote.id
  });
  expect(hold.status).toBe(409);
});
