export interface DemoApi {
  approveItinerary(quoteId: string): Promise<{ approvedAt: string }>;
  requestHold(quoteId: string): Promise<{ holdId: string; expiresAt: string }>;
  approvePayment(holdId: string): Promise<{ approvedAt: string }>;
}

async function requestJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "T-Bud could not complete that action");
  }

  return payload as T;
}

export const demoApi: DemoApi = {
  approveItinerary: (quoteId) =>
    requestJson("/api/demo/approve-itinerary", { quoteId }),
  requestHold: (quoteId) => requestJson("/api/demo/holds", { quoteId }),
  approvePayment: (holdId) =>
    requestJson("/api/demo/approve-payment", { holdId })
};
