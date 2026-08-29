export interface ModelContextTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute(input: unknown): Promise<unknown>;
}

export interface ModelContext {
  registerTool(tool: ModelContextTool, options?: { signal?: AbortSignal }): Promise<void>;
}

interface WebMcpHost {
  modelContext?: ModelContext;
}

interface RegisterDependencies {
  documentObject?: WebMcpHost;
  navigatorObject?: WebMcpHost;
  fetcher?: typeof fetch;
}

const objectSchema = (
  properties: Record<string, Record<string, unknown>>,
  required: string[]
) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false
});

export async function registerTBudTools(
  dependencies: RegisterDependencies = {}
): Promise<{ registered: string[]; supported: boolean }> {
  const documentObject =
    dependencies.documentObject ??
    (typeof document === "undefined" ? undefined : document);
  const navigatorObject =
    dependencies.navigatorObject ??
    (typeof navigator === "undefined" ? undefined : navigator);
  const modelContext =
    documentObject?.modelContext ?? navigatorObject?.modelContext;

  if (!modelContext?.registerTool) {
    return { registered: [], supported: false };
  }

  const fetcher = dependencies.fetcher ?? fetch.bind(globalThis);
  const invoke = async (path: string, input: unknown) => {
    const response = await fetcher(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? "T-Bud could not complete that tool call");
    }
    return payload;
  };

  const definitions: ModelContextTool[] = [
    {
      name: "search_treks",
      title: "Search T-Bud treks",
      description: "Find active treks with enough seats for the requested group.",
      inputSchema: objectSchema(
        {
          location: { type: "string", minLength: 1, maxLength: 80 },
          partySize: { type: "integer", minimum: 1, maximum: 12 }
        },
        ["location", "partySize"]
      ),
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: (input) => invoke("/api/tools/search_treks", input)
    },
    {
      name: "get_availability",
      title: "Check trek availability",
      description: "Read active departures with enough seats for the requested group.",
      inputSchema: objectSchema(
        {
          trekId: { type: "string", minLength: 1, maxLength: 120 },
          partySize: { type: "integer", minimum: 1, maximum: 12 }
        },
        ["trekId", "partySize"]
      ),
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: (input) => invoke("/api/tools/get_availability", input)
    },
    {
      name: "quote_bundle",
      title: "Prepare a trek quote",
      description:
        "Create a budget-aware booking quote from authoritative T-Bud catalog prices for human review.",
      inputSchema: objectSchema(
        { text: { type: "string", minLength: 1, maxLength: 2_000 } },
        ["text"]
      ),
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => invoke("/api/tools/quote_bundle", input)
    },
    {
      name: "request_hold",
      title: "Hold trek seats",
      description:
        "Temporarily hold seats only for an approved quote bound to the current human session.",
      inputSchema: objectSchema(
        { quoteId: { type: "string", minLength: 1, maxLength: 160 } },
        ["quoteId"]
      ),
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => invoke("/api/tools/request_hold", input)
    },
    {
      name: "create_checkout",
      title: "Create a Razorpay order",
      description:
        "Create a Razorpay order for a quote the human has already approved for payment. Fails without that approval.",
      inputSchema: objectSchema(
        { quoteId: { type: "string", minLength: 1, maxLength: 160 } },
        ["quoteId"]
      ),
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => invoke("/api/tools/create_checkout", input)
    }
  ];

  const registered: string[] = [];
  for (const definition of definitions) {
    try {
      await modelContext.registerTool(definition);
      registered.push(definition.name);
    } catch {
      // A partial implementation must not prevent the page from loading.
    }
  }

  return { registered, supported: true };
}
