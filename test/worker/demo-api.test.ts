import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import worker from "../../worker";
import { hashSessionId } from "../../worker/http/security";

it("binds itinerary approval to a hashed browser session", async () => {
  const bootstrap = await worker.fetch(
    new Request("https://t-bud.test/api/health"),
    env,
    createExecutionContext()
  );
  const setCookie = bootstrap.headers.get("set-cookie")!;
  const cookie = setCookie.split(";", 1)[0];
  const rawSession = cookie.split("=", 2)[1];

  const response = await worker.fetch(
    new Request("https://t-bud.test/api/demo/approve-itinerary", {
      method: "POST",
      headers: {
        origin: "https://t-bud.test",
        cookie,
        "content-type": "application/json"
      },
      body: JSON.stringify({ quoteId: "quote_demo_v2" })
    }),
    env,
    createExecutionContext()
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    approvedAt: expect.any(String)
  });
  const approval = await env.DB.prepare(
    "SELECT actor_session_id FROM approvals WHERE quote_id = ? AND gate = 'itinerary'"
  )
    .bind("quote_demo_v2")
    .first<{ actor_session_id: string }>();
  expect(approval?.actor_session_id).toBe(await hashSessionId(rawSession));
  expect(approval?.actor_session_id).not.toBe(rawSession);

  const quote = await env.DB.prepare("SELECT total FROM quotes WHERE id = ?")
    .bind("quote_demo_v2")
    .first<{ total: number }>();
  expect(quote?.total).toBe(1_960_000);
});

it("holds seats only after the current human session approves", async () => {
  const bootstrap = await worker.fetch(
    new Request("https://t-bud.test/api/health"),
    env,
    createExecutionContext()
  );
  const cookie = bootstrap.headers.get("set-cookie")!.split(";", 1)[0];
  const request = (path: string) =>
    worker.fetch(
      new Request(`https://t-bud.test${path}`, {
        method: "POST",
        headers: {
          origin: "https://t-bud.test",
          cookie,
          "content-type": "application/json"
        },
        body: JSON.stringify({ quoteId: "quote_demo_v2" })
      }),
      env,
      createExecutionContext()
    );

  const blocked = await request("/api/demo/holds");
  expect(blocked.status).toBe(409);

  const approval = await request("/api/demo/approve-itinerary");
  expect(approval.status).toBe(200);
  const held = await request("/api/demo/holds");
  expect(held.status).toBe(200);
  await expect(held.json()).resolves.toMatchObject({
    status: "held",
    holdId: expect.any(String),
    expiresAt: expect.any(String)
  });
});
