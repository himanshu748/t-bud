import type {
  BookingQuote,
  BookingReceipt
} from "../features/demo/demoReducer";

export interface BookingApi {
  createQuote(text: string): Promise<{
    quote: BookingQuote;
    policy: { status: "eligible" | "budget_conflict" };
    intentSource: "workers_ai" | "rules_fallback";
    recommendationSource: "workers_ai" | "rules_fallback";
  }>;
  approveItinerary(quoteId: string): Promise<{ approvedAt: string }>;
  approveHold(quoteId: string): Promise<{ approvedAt: string }>;
  requestHold(quoteId: string): Promise<{ holdId: string; expiresAt: string }>;
  getReceipt(quoteId: string): Promise<BookingReceipt>;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin" });
  const payload = (await response.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "T-Bud could not verify the server receipt");
  }
  return payload as T;
}

export type DemoApi = BookingApi;

async function requestJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
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

export const bookingApi: BookingApi = {
  createQuote: (text) => requestJson("/api/tools/quote_bundle", { text }),
  approveItinerary: (quoteId) =>
    requestJson("/api/bookings/approve-itinerary", { quoteId }),
  approveHold: (quoteId) =>
    requestJson("/api/bookings/approve-hold", { quoteId }),
  getReceipt: (quoteId) =>
    getJson(`/api/bookings/${encodeURIComponent(quoteId)}/receipt`),
  requestHold: async (quoteId) => {
    const result = await requestJson<{
      hold: {
        status: "held" | "capacity_conflict" | "expired";
        holdId?: string;
        expiresAt?: string;
      };
    }>("/api/tools/request_hold", { quoteId });
    if (
      result.hold.status !== "held" ||
      !result.hold.holdId ||
      !result.hold.expiresAt
    ) {
      throw new Error(
        result.hold.status === "capacity_conflict"
          ? "Those seats just sold out. Prepare a new quote."
          : "The quote expired before the hold was created."
      );
    }
    return {
      holdId: result.hold.holdId,
      expiresAt: result.hold.expiresAt
    };
  }
};

export const demoApi = bookingApi;
