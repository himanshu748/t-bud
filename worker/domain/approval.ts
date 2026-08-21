import type { Quote } from "./types";

export type ApprovalGate = "itinerary" | "payment";

export interface Approval {
  quoteId: string;
  quoteVersion: number;
  actorSessionId: string;
  gate: ApprovalGate;
  digest: string;
  approvedAt: string;
}

function canonicalQuote(quote: Quote, actorSessionId: string): string {
  return JSON.stringify({
    trekId: quote.trekId,
    departureId: quote.departureId,
    partySize: quote.partySize,
    items: quote.items.map((item) => ({
      id: item.id,
      kind: item.kind,
      quantity: item.quantity,
      unitAmount: item.unitAmount,
      amount: item.amount
    })),
    total: quote.total,
    currency: quote.currency,
    version: quote.version,
    expiresAt: quote.expiresAt,
    actorSessionId
  });
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export async function quoteDigest(
  quote: Quote,
  actorSessionId: string
): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalQuote(quote, actorSessionId));
  return toHex(await crypto.subtle.digest("SHA-256", bytes));
}

export async function approvalMatches(
  approval: Approval,
  quote: Quote,
  actorSessionId: string
): Promise<boolean> {
  if (
    approval.quoteId !== quote.id ||
    approval.quoteVersion !== quote.version ||
    approval.actorSessionId !== actorSessionId ||
    Date.parse(quote.expiresAt) <= Date.now()
  ) {
    return false;
  }

  return approval.digest === (await quoteDigest(quote, actorSessionId));
}
