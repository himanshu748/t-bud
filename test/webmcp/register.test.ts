import { describe, expect, it, vi } from "vitest";
import {
  registerTBudTools,
  type ModelContextTool
} from "../../src/webmcp/register";

describe("registerTBudTools", () => {
  it("feature detects WebMCP without breaking unsupported browsers", async () => {
    await expect(
      registerTBudTools({ documentObject: {}, navigatorObject: {} })
    ).resolves.toEqual({ registered: [], supported: false });
  });

  it("registers five narrowly described booking tools", async () => {
    const registered: ModelContextTool[] = [];
    const registerTool = vi.fn(async (tool: ModelContextTool) => {
      registered.push(tool);
    });

    const result = await registerTBudTools({
      documentObject: { modelContext: { registerTool } },
      navigatorObject: {},
      fetcher: vi.fn()
    });

    expect(result).toEqual({
      supported: true,
      registered: [
        "search_treks",
        "get_availability",
        "quote_bundle",
        "request_hold",
        "create_checkout"
      ]
    });
    expect(registered.map((tool) => tool.name)).toEqual(result.registered);
    expect(registered[0]).toMatchObject({
      annotations: { readOnlyHint: true, untrustedContentHint: false }
    });
    expect(registered[1]).toMatchObject({
      annotations: { readOnlyHint: true, untrustedContentHint: false }
    });
    expect(registered[2]).toMatchObject({
      annotations: { readOnlyHint: false, untrustedContentHint: false }
    });
    expect(registered[3].description).toContain("approved quote");
    expect(registered[4].description).toContain("opens Razorpay");
  });

  it("routes tool execution through same-origin HTTP endpoints", async () => {
    const tools = new Map<string, { execute(input: unknown): Promise<unknown> }>();
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, total: 1_960_000 }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    await registerTBudTools({
      documentObject: {
        modelContext: {
          registerTool: async (tool) => {
            tools.set(tool.name, tool);
          }
        }
      },
      navigatorObject: {},
      fetcher
    });

    await expect(
      tools.get("quote_bundle")?.execute({ text: "Manali trek for four" })
    ).resolves.toEqual({ ok: true, total: 1_960_000 });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/tools/quote_bundle",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify({ text: "Manali trek for four" })
      })
    );
  });
});
