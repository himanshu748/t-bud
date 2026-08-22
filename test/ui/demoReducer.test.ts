import { describe, expect, it } from "vitest";
import {
  bookingIntentText,
  createInitialDemoState,
  demoReducer,
  type BookingQuote
} from "../../src/features/demo/demoReducer";

const quote: BookingQuote = {
  id: "quote_live",
  version: 1,
  total: 1_960_000,
  budget: 2_000_000,
  expiresAt: "2026-08-21T10:15:00.000Z",
  departureId: "dep_hampta_2026_09_12",
  items: []
};

describe("live booking reducer", () => {
  it("serializes editable intent for the real quote endpoint", () => {
    const initial = createInitialDemoState();
    expect(bookingIntentText(initial.intent)).toContain(
      "2-day Manali trek for 4 people under ₹20,000"
    );
  });

  it("stops an over-budget quote at human review", () => {
    const initial = createInitialDemoState("quoting");
    const next = demoReducer(initial, {
      type: "QUOTE_RECEIVED",
      quote: { ...quote, budget: 1_900_000 },
      policyStatus: "budget_conflict",
      intentSource: "rules_fallback",
      recommendationSource: "rules_fallback"
    });

    expect(next.phase).toBe("budget_conflict");
    expect(next.pendingHumanAction).toBeNull();
    expect(next.ledger.at(-1)?.label).toBe("Budget policy stopped the quote");
  });

  it("moves an eligible live quote to itinerary approval", () => {
    const initial = createInitialDemoState("quoting");
    const next = demoReducer(initial, {
      type: "QUOTE_RECEIVED",
      quote,
      policyStatus: "eligible",
      intentSource: "rules_fallback",
      recommendationSource: "rules_fallback"
    });

    expect(next.phase).toBe("quote_ready");
    expect(next.quote?.total).toBe(1_960_000);
    expect(next.pendingHumanAction).toBe("approve_itinerary");
  });

  it("reveals the hold action only after itinerary approval succeeds", () => {
    const initial = createInitialDemoState("quote_ready");
    const next = demoReducer(initial, {
      type: "ITINERARY_APPROVED",
      approvedAt: "2026-08-21T10:00:00.000Z"
    });

    expect(next.phase).toBe("itinerary_approved");
    expect(next.pendingHumanAction).toBe("request_hold");
    expect(next.ledger.at(-1)?.label).toBe("Human approved itinerary");
  });

  it("preserves the current human gate when an API action fails", () => {
    const initial = createInitialDemoState("quote_ready");
    const next = demoReducer(initial, {
      type: "REQUEST_FAILED",
      message: "Approval could not be verified"
    });

    expect(next.phase).toBe("quote_ready");
    expect(next.pendingHumanAction).toBe("approve_itinerary");
    expect(next.error).toBe("Approval could not be verified");
  });
});
