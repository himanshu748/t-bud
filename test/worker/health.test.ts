import { env } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import worker from "../../worker";

it("reports the T-Bud service as healthy", async () => {
  const ctx = createExecutionContext();
  const response = await worker.fetch(
    new Request("https://t-bud.test/api/health"),
    env,
    ctx
  );

  await waitOnExecutionContext(ctx);

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ ok: true, service: "t-bud" });
});
