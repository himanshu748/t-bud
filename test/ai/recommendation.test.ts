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

it("keeps a spelled-out group size and explicit INR ceiling when AI fails", async () => {
  const result = await structureIntent("Please plan a two-day one-night trek in Manali for six people. Our total budget is INR 30,000; include pickup.");
  expect(result.intent).toMatchObject({ partySize: 6, budget: 3_000_000, durationDays: 2, durationNights: 1, requestedAddonCategories: ["pickup"] });
});

it("accepts fenced schema-valid JSON but never lets AI change explicit money or headcount", async () => {
  const run = vi.fn().mockResolvedValue({ response: '```json\n' + JSON.stringify({ ...request, partySize: 1, budget: 300_000 }) + '\n```' });
  const result = await structureIntent("Manali trek for six people total INR 30,000 with pickup and meals", { run });
  expect(result.source).toBe("workers_ai");
  expect(result.intent).toMatchObject({ partySize: 6, budget: 3_000_000 });
  expect(run.mock.calls[0]![0]).toHaveProperty("schema.additionalProperties", false);
});

it.each([
  "Manali trek with pickup under INR 30,000",
  "Manali trek for six people",
  "Manali trek for 14 people under INR 30,000",
  "Manali trek for 4 people or 6 people under INR 30,000",
  "Manali trek for six people at INR 5,000 per person"
])("asks for an unambiguous group and total budget: %s", async (text) => {
  await expect(structureIntent(text)).rejects.toThrow(/State one/);
});

it("does not substitute Manali for an unsupported destination when AI is unavailable", async () => {
  await expect(structureIntent("Shimla trek for six people under INR 30,000")).rejects.toThrow(/supports Manali/);
});

it("does not add explicitly excluded extras in fallback mode", async () => {
  const result = await structureIntent("Manali trek for six people under INR 30,000 without pickup and meals");
  expect(result.intent.requestedAddonCategories).toEqual([]);
});


it("emits a recommendation schema supported by Workers AI JSON mode", async () => {
  const run = vi.fn().mockResolvedValue({ response: { addonIds: ["pickup_manali", "meals_budget"], reasons: {} } });
  const result = await recommendAddons({ request, availableAddons: addons }, { run });
  expect(result.source).toBe("workers_ai");
  expect(run.mock.calls[0]![0].schema.properties.reasons).not.toHaveProperty("propertyNames");
});
