import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import worker from "../../worker";

it("publishes a cacheable A2A v1 JSON-RPC booking skill", async () => {
  const response = await worker.fetch(
    new Request("https://t-bud.test/.well-known/agent-card.json"),
    env,
    createExecutionContext()
  );
  const card = await response.json<{
    name: string;
    supportedInterfaces: unknown[];
    capabilities: Record<string, boolean>;
    skills: Array<{ id: string }>;
  }>();

  expect(response.status).toBe(200);
  expect(card.name).toBe("T-Bud Merchant Booking Agent");
  expect(card.supportedInterfaces).toContainEqual({
    url: "https://t-bud.test/a2a/v1",
    protocolBinding: "JSONRPC",
    protocolVersion: "1.0"
  });
  expect(card.skills.map((skill) => skill.id)).toContain("book_manali_trek");
  expect(card.capabilities).toEqual({
    streaming: false,
    pushNotifications: false,
    extendedAgentCard: false
  });
  expect(response.headers.get("cache-control")).toContain("max-age=");
  expect(response.headers.get("etag")).toBeTruthy();
});

it("returns 304 for a matching Agent Card ETag", async () => {
  const first = await worker.fetch(
    new Request("https://t-bud.test/.well-known/agent-card.json"),
    env,
    createExecutionContext()
  );
  const etag = first.headers.get("etag")!;
  const cached = await worker.fetch(
    new Request("https://t-bud.test/.well-known/agent-card.json", {
      headers: { "if-none-match": etag }
    }),
    env,
    createExecutionContext()
  );

  expect(cached.status).toBe(304);
});
