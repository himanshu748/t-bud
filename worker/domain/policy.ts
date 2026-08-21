import { money, sumMoney } from "./money";
import type {
  Addon,
  BookingRequest,
  PolicyResult,
  QuoteItem,
  Trek
} from "./types";

function trekItem(trek: Trek, partySize: number): QuoteItem {
  return {
    id: trek.id,
    kind: "trek",
    name: trek.name,
    quantity: partySize,
    unitAmount: trek.unitAmount,
    amount: money(trek.unitAmount * partySize)
  };
}

function addonItem(addon: Addon, partySize: number): QuoteItem {
  const quantity = addon.scope === "per_person" ? partySize : 1;
  return {
    id: addon.id,
    kind: "addon",
    name: addon.name,
    quantity,
    unitAmount: addon.unitAmount,
    amount: money(addon.unitAmount * quantity)
  };
}

export function evaluateBundle(
  request: BookingRequest,
  trek: Trek,
  addons: Addon[]
): PolicyResult {
  const items = [
    trekItem(trek, request.partySize),
    ...addons.filter((addon) => addon.active).map((addon) => addonItem(addon, request.partySize))
  ];
  const total = sumMoney(items.map((item) => item.amount));

  if (total > request.budget) {
    return {
      status: "budget_conflict",
      items,
      total,
      overBy: money(total - request.budget),
      requiresHumanApproval: true
    };
  }

  return {
    status: "eligible",
    items,
    total,
    requiresHumanApproval: false
  };
}

export function findSmallestEligibleRevision(
  request: BookingRequest,
  trek: Trek,
  selectedAddons: Addon[],
  alternatives: Addon[]
): PolicyResult {
  const candidates = alternatives.flatMap((alternative) => {
    const replacementIndex = selectedAddons.findIndex(
      (selected) => selected.category === alternative.category
    );
    if (replacementIndex < 0) return [];

    const revised = [...selectedAddons];
    revised[replacementIndex] = alternative;
    const result = evaluateBundle(request, trek, revised);
    return result.status === "eligible" ? [result] : [];
  });

  const best = candidates.sort((left, right) => right.total - left.total)[0];
  if (!best) return evaluateBundle(request, trek, selectedAddons);

  return { ...best, requiresHumanApproval: true };
}
