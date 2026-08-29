import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import worker from "../../worker";

it("reports the public agent contract and Durable Object capacity", async () => {
  const response = await worker.fetch(
    new Request("https://t-bud.test/api/merchant/overview"),
    env,
    createExecutionContext()
  );
  const body = await response.json<{
    agentCard: { protocolVersion: string; skills: Array<{ id: string }> };
    webmcpTools: string[];
    paymentsEnabled: boolean;
    departures: Array<{ available: number; capacity: number }>;
  }>();

  expect(response.status).toBe(200);
  expect(body.agentCard).toMatchObject({
    protocolVersion: "1.0",
    skills: [{ id: "book_manali_trek" }]
  });
  expect(body.webmcpTools).toContain("create_checkout");
  expect(body.paymentsEnabled).toBe(true);
  expect(body.departures[0]).toMatchObject({ capacity: 4, available: 4 });
});
