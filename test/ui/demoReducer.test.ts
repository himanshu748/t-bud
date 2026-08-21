import { describe, expect, it } from "vitest";
import {
  createInitialDemoState,
  demoReducer
} from "../../src/features/demo/demoReducer";

describe("demoReducer", () => {
  it("stops a budget conflict at human review", () => {
    const initial = createInitialDemoState("searching");
    const next = demoReducer(initial, {
      type: "PREMIUM_QUOTE_RECEIVED",
      total: 2_080_000
    });

    expect(next.phase).toBe("budget_conflict");
    expect(next.pendingHumanAction).toBe("review_cheaper_bundle");
    expect(next.ledger.at(-1)?.label).toBe("Premium bundle exceeds budget");
  });

  it("moves a reviewed revision to itinerary approval", () => {
    const initial = createInitialDemoState("budget_conflict");
    const next = demoReducer(initial, { type: "REVISION_ACCEPTED" });

    expect(next.phase).toBe("quote_ready");
    expect(next.quote.total).toBe(1_960_000);
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

  it("appends exactly one ledger event for every transition", () => {
    const initial = createInitialDemoState("quote_ready");
    const next = demoReducer(initial, {
      type: "REQUEST_FAILED",
      message: "Approval could not be verified"
    });

    expect(next.ledger).toHaveLength(initial.ledger.length + 1);
    expect(next.error).toBe("Approval could not be verified");
  });
});
