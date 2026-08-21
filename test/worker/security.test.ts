import { env } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import worker from "../../worker";

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
