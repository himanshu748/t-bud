import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import worker from "../../worker";

const intent =
  "2-day Manali trek for four friends under ₹20,000 with pickup and upgraded meals";

async function bootstrapSession() {
  const response = await worker.fetch(
    new Request("https://t-bud.test/api/health"),
    env,
    createExecutionContext()
  );
  return response.headers.get("set-cookie")!.split(";", 1)[0];
}

it("returns the same authoritative quote through WebMCP HTTP and A2A", async () => {
  const cookie = await bootstrapSession();
  const webmcp = await worker.fetch(
    new Request("https://t-bud.test/api/tools/quote_bundle", {
      method: "POST",
      headers: {
        origin: "https://t-bud.test",
        cookie,
        "content-type": "application/json"
      },
      body: JSON.stringify({ text: intent })
    }),
    env,
    createExecutionContext()
  );
  const webmcpBody = await webmcp.json<{
    quote: { total: number; items: Array<{ id: string; amount: number }> };
    policy: { status: string };
  }>();

  const a2a = await worker.fetch(
    new Request("https://t-bud.test/a2a/v1", {
      method: "POST",
      headers: { "content-type": "application/json", "A2A-Version": "1.0" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "parity",
        method: "SendMessage",
        params: {
          message: {
            messageId: crypto.randomUUID(),
            role: "ROLE_USER",
            parts: [{ text: intent }]
          }
        }
      })
    }),
    env,
    createExecutionContext()
  );
  const a2aBody = await a2a.json<{
    result: {
      task: {
        artifacts: Array<{
          parts: Array<{
            data: {
              total: number;
              policyStatus: string;
              items: Array<{ id: string; amount: number }>;
            };
          }>;
        }>;
      };
    };
  }>();
  const artifact = a2aBody.result.task.artifacts[0].parts[0].data;

  expect(webmcp.status).toBe(200);
  expect(a2a.status).toBe(200);
  expect({
    total: webmcpBody.quote.total,
    status: webmcpBody.policy.status,
    items: webmcpBody.quote.items.map(({ id, amount }) => ({ id, amount }))
  }).toEqual({
    total: artifact.total,
    status: artifact.policyStatus,
    items: artifact.items.map(({ id, amount }) => ({ id, amount }))
  });
});
