import { transition } from "../../worker/domain/state-machine";

it("requires itinerary approval before a hold", () => {
  expect(() =>
    transition("quote_ready", { type: "HOLD_REQUESTED" })
  ).toThrow("itinerary approval required");
});

it("moves an approved itinerary into a pending hold", () => {
  expect(
    transition("itinerary_approved", { type: "HOLD_REQUESTED" })
  ).toBe("hold_pending");
});

it("requires a fresh quote after capacity changes", () => {
  expect(
    transition("hold_pending", { type: "CAPACITY_CONFLICT" })
  ).toBe("capacity_conflict");
  expect(
    transition("capacity_conflict", { type: "QUOTE_CREATED" })
  ).toBe("quote_ready");
});

it("releases the active flow when cancelled", () => {
  expect(transition("held", { type: "CANCELLED" })).toBe("cancelled");
});
