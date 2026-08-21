import { describe, expect, it, vi } from "vitest";
import { money } from "../../worker/domain/money";
import type { Addon, BookingRequest } from "../../worker/domain/types";
import {
  recommendAddons,
  structureIntent,
  type RecommendationModel
} from "../../worker/ai/recommendation";

const request: BookingRequest = {
  location: "Manali",
  partySize: 4,
  budget: money(2_000_000),
  durationDays: 2,
  durationNights: 1,
  difficulty: "moderate",
  requestedAddonCategories: ["pickup", "meals"]
};

const addons: Addon[] = [
  { id: "pickup_manali", name: "Manali pickup", category: "pickup", scope: "per_booking", unitAmount: money(200_000), active: true },
  { id: "meals_premium", name: "Premium meals", category: "meals", scope: "per_person", unitAmount: money(70_000), active: true },
  { id: "meals_budget", name: "Upgraded meals", category: "meals", scope: "per_person", unitAmount: money(40_000), active: true }
];

function model(response: unknown): RecommendationModel {
  return { run: vi.fn().mockResolvedValue({ response: JSON.stringify(response) }) };
}

describe("bounded Workers AI adapters", () => {
  it("uses the deterministic fallback when model output is invalid", async () => {
    const invalid = { run: vi.fn().mockResolvedValue({ response: "not-json" }) };
    const result = await recommendAddons({ request, availableAddons: addons }, invalid);

    expect(result.source).toBe("rules_fallback");
    expect(result.addonIds).toEqual(["pickup_manali", "meals_budget"]);
  });

  it("never accepts model-authored prices", async () => {
    const result = await recommendAddons(
      { request, availableAddons: addons },
      model({ addonIds: ["pickup_manali"], reasons: {}, price: 1 })
    );

    expect(result).not.toHaveProperty("price");
    expect(result.source).toBe("rules_fallback");
  });

  it("filters unknown add-on identifiers", async () => {
    const result = await recommendAddons(
      { request, availableAddons: addons },
      model({ addonIds: ["invented_addon"], reasons: { invented_addon: "Buy this" } })
    );

    expect(result.source).toBe("rules_fallback");
    expect(result.addonIds).not.toContain("invented_addon");
  });

  it("structures the Manali request without granting action authority", async () => {
    const result = await structureIntent(
      "2-day Manali trek for four friends under ₹20,000 with pickup and upgraded meals",
      model(request)
    );

    expect(result.intent).toMatchObject({
      partySize: 4,
      budget: 2_000_000,
      durationDays: 2,
      durationNights: 1
    });
    expect(result.intent).not.toHaveProperty("approved");
    expect(result.intent).not.toHaveProperty("price");
  });
});
