import {
  evaluateBundle,
  findSmallestEligibleRevision
} from "../../worker/domain/policy";
import {
  bookingRequest,
  budgetMeals,
  pickup,
  premiumMeals,
  trek
} from "../fixtures/catalog";

it("rejects the premium bundle above ₹20,000", () => {
  const result = evaluateBundle(bookingRequest, trek, [pickup, premiumMeals]);

  expect(result).toMatchObject({
    status: "budget_conflict",
    total: 2_080_000,
    overBy: 80_000
  });
});

it("accepts pickup and upgraded meals at ₹19,600", () => {
  const result = evaluateBundle(bookingRequest, trek, [pickup, budgetMeals]);

  expect(result).toMatchObject({
    status: "eligible",
    total: 1_960_000,
    requiresHumanApproval: true
  });
});

it("proposes the smallest eligible change without silently removing pickup", () => {
  const result = findSmallestEligibleRevision(
    bookingRequest,
    trek,
    [pickup, premiumMeals],
    [budgetMeals]
  );

  expect(result).toMatchObject({
    status: "eligible",
    total: 1_960_000,
    requiresHumanApproval: true
  });
  expect(result.items.map((item) => item.id)).toEqual([
    "trek_hampta",
    "pickup_manali",
    "meals_budget"
  ]);
});
