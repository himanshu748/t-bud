import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import worker from "../../worker";

async function post(path: string) {
  const bootstrap = await worker.fetch(
    new Request("https://t-bud.test/api/health"),
    env,
    createExecutionContext()
  );
  const cookie = bootstrap.headers.get("set-cookie")!.split(";", 1)[0];
  return worker.fetch(
    new Request(`https://t-bud.test${path}`, {
      method: "POST",
      headers: {
        origin: "https://t-bud.test",
        cookie,
        "content-type": "application/json"
      },
      body: JSON.stringify({ quoteId: "quote_any" })
    }),
    env,
    createExecutionContext()
  );
}

it("keeps payment and checkout endpoints disabled for the live pilot", async () => {
  for (const path of ["/api/payments/order", "/api/tools/create_checkout"]) {
    const response = await post(path);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "payments_disabled",
        message: "Payment collection is not enabled for this pilot"
      }
    });
  }
});
