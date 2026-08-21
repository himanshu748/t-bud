import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import worker from "../../worker";

async function rpc(method: string, params: Record<string, unknown>, version = "1.0") {
  return worker.fetch(
    new Request("https://t-bud.test/a2a/v1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "A2A-Version": version
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: "rpc-1", method, params })
    }),
    env,
    createExecutionContext()
  );
}

it("creates, retrieves and cancels a human-gated booking task", async () => {
  const sent = await rpc("SendMessage", {
    message: {
      messageId: crypto.randomUUID(),
      role: "ROLE_USER",
      parts: [
        {
          text: "2-day Manali trek for four friends under ₹20,000 with pickup and upgraded meals"
        }
      ]
    }
  });
  const sentBody = await sent.json<{
    result: {
      task: {
        id: string;
        contextId: string;
        status: { state: string };
        artifacts: Array<{ name: string; parts: Array<{ data: Record<string, unknown> }> }>;
      };
    };
  }>();

  expect(sent.status).toBe(200);
  expect(sentBody.result.task.status.state).toBe("TASK_STATE_INPUT_REQUIRED");
  expect(sentBody.result.task.contextId).toBeTruthy();
  expect(sentBody.result.task.artifacts[0]).toMatchObject({
    name: "T-Bud trek quote",
    parts: [{ data: { total: 1_960_000, requiresHumanApproval: true } }]
  });

  const fetched = await rpc("GetTask", { id: sentBody.result.task.id });
  const fetchedBody = await fetched.json<{ result: { id: string; contextId: string } }>();
  expect(fetchedBody.result).toMatchObject({
    id: sentBody.result.task.id,
    contextId: sentBody.result.task.contextId
  });

  const cancelled = await rpc("CancelTask", { id: sentBody.result.task.id });
  const cancelledBody = await cancelled.json<{ result: { status: { state: string } } }>();
  expect(cancelledBody.result.status.state).toBe("TASK_STATE_CANCELED");
});

it("returns protocol errors for unsupported versions and methods", async () => {
  const version = await rpc("GetTask", { id: "missing" }, "0.3");
  await expect(version.json()).resolves.toMatchObject({
    error: { code: -32009 }
  });

  const method = await rpc("StreamEverything", {});
  await expect(method.json()).resolves.toMatchObject({
    error: { code: -32601 }
  });
});
