import { env } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { vi } from "vitest";
import worker from "../../worker";
import { enforceRateLimit, hashSessionId } from "../../worker/http/security";

it("protects browser responses with restrictive security headers", async () => {
  const ctx = createExecutionContext();
  const response = await worker.fetch(
    new Request("https://t-bud.test/"),
    env,
    ctx
  );

  await waitOnExecutionContext(ctx);

  expect(response.headers.get("content-security-policy")).toContain(
    "default-src 'self'"
  );
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("referrer-policy")).toBe(
    "strict-origin-when-cross-origin"
  );
  expect(response.headers.get("permissions-policy")).toBe(
    "camera=(), microphone=(), geolocation=()"
  );
});

it("issues an opaque secure browser session cookie", async () => {
  const response = await worker.fetch(
    new Request("https://t-bud.test/api/health"),
    env,
    createExecutionContext()
  );

  const cookie = response.headers.get("set-cookie");
  expect(cookie).toContain("tb_session=");
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("Secure");
  expect(cookie).toContain("SameSite=Lax");
});

it("rejects a cross-origin browser mutation", async () => {
  const response = await worker.fetch(
    new Request("https://t-bud.test/api/demo/approve-itinerary", {
      method: "POST",
      headers: {
        origin: "https://attacker.test",
        "content-type": "application/json"
      },
      body: JSON.stringify({ quoteId: "quote_demo_v2" })
    }),
    env,
    createExecutionContext()
  );

  expect(response.status).toBe(403);
  await expect(response.json()).resolves.toMatchObject({
    error: { code: "origin_not_allowed" }
  });
});

it("keys rate limits with the hashed session and route", async () => {
  const limit = vi.fn().mockResolvedValue({ success: false });
  const sessionHash = await hashSessionId("opaque-session-token");

  await expect(
    enforceRateLimit({ limit }, sessionHash, "/api/tools/quote")
  ).resolves.toBe(false);
  expect(limit).toHaveBeenCalledWith({
    key: `${sessionHash}:/api/tools/quote`
  });
  expect(JSON.stringify(limit.mock.calls)).not.toContain("opaque-session-token");
});
