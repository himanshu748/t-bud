import { z } from "zod";
import { money } from "../domain/money";
import type { Addon, BookingRequest } from "../domain/types";

const RecommendationSchema = z
  .object({
    addonIds: z.array(z.string().max(80)).max(3),
    reasons: z.record(z.string(), z.string().max(180))
  })
  .strict();

const BookingIntentSchema = z
  .object({
    location: z.string().min(1).max(80),
    partySize: z.number().int().min(1).max(12),
    budget: z.number().int().nonnegative(),
    durationDays: z.number().int().min(1).max(14),
    durationNights: z.number().int().min(0).max(13),
    difficulty: z.enum(["easy", "moderate", "hard"]),
    requestedAddonCategories: z
      .array(z.enum(["pickup", "meals"]))
      .max(2)
  })
  .strict();

export interface RecommendationModel {
  run(input: { system: string; user: string }): Promise<unknown>;
}

export interface RecommendationInput {
  request: BookingRequest;
  availableAddons: Addon[];
}

export interface RecommendationResult {
  source: "workers_ai" | "rules_fallback";
  addonIds: string[];
  reasons: Record<string, string>;
}

export interface StructuredIntentResult {
  source: "workers_ai" | "rules_fallback";
  intent: BookingRequest;
}

function responseValue(raw: unknown): unknown {
  if (typeof raw === "string") return JSON.parse(raw) as unknown;
  if (raw && typeof raw === "object" && "response" in raw) {
    return responseValue((raw as { response: unknown }).response);
  }
  return raw;
}

function fallbackRecommendation(input: RecommendationInput): RecommendationResult {
  const addonIds = input.request.requestedAddonCategories.flatMap((category) => {
    const cheapest = input.availableAddons
      .filter((addon) => addon.active && addon.category === category)
      .sort((left, right) => left.unitAmount - right.unitAmount)[0];
    return cheapest ? [cheapest.id] : [];
  });

  return {
    source: "rules_fallback",
    addonIds,
    reasons: Object.fromEntries(
      addonIds.map((id) => [id, "Matches a requested category and the deterministic budget preference."])
    )
  };
}

function fallbackIntent(text: string): StructuredIntentResult {
  const normalized = text.toLowerCase();
  const numericParty = normalized.match(/(?:for|party of)\s+(\d{1,2})/)?.[1];
  const partySize = numericParty
    ? Number(numericParty)
    : normalized.includes("four")
      ? 4
      : 1;
  const budgetText = normalized.match(/(?:₹|rs\.?|inr)\s*([\d,]+)/)?.[1];
  const budgetRupees = budgetText ? Number(budgetText.replaceAll(",", "")) : 20_000;
  const days = Number(normalized.match(/(\d+)\s*[- ]?day/)?.[1] ?? 2);
  const nights = Number(normalized.match(/(\d+)\s*[- ]?night/)?.[1] ?? Math.max(0, days - 1));

  return {
    source: "rules_fallback",
    intent: {
      location: normalized.includes("manali") ? "Manali" : "Manali",
      partySize,
      budget: money(budgetRupees * 100),
      durationDays: days,
      durationNights: nights,
      difficulty: normalized.includes("occasional") ? "moderate" : "moderate",
      requestedAddonCategories: [
        ...(normalized.includes("pickup") ? (["pickup"] as const) : []),
        ...(normalized.includes("meal") ? (["meals"] as const) : [])
      ]
    }
  };
}

export async function recommendAddons(
  input: RecommendationInput,
  model?: RecommendationModel
): Promise<RecommendationResult> {
  if (!model) return fallbackRecommendation(input);

  try {
    const raw = await model.run({
      system:
        "Return strict JSON with addonIds and short reasons. Recommend only supplied IDs. Never invent prices or approval state.",
      user: JSON.stringify({
        request: input.request,
        availableAddons: input.availableAddons.map((addon) => ({
          id: addon.id,
          category: addon.category,
          scope: addon.scope
        }))
      })
    });
    const parsed = RecommendationSchema.parse(responseValue(raw));
    const allowed = new Set(input.availableAddons.filter((addon) => addon.active).map((addon) => addon.id));
    const addonIds = parsed.addonIds.filter((id) => allowed.has(id));
    if (addonIds.length === 0 && input.request.requestedAddonCategories.length > 0) {
      return fallbackRecommendation(input);
    }

    return {
      source: "workers_ai",
      addonIds,
      reasons: Object.fromEntries(
        addonIds.map((id) => [id, parsed.reasons[id] ?? "Matches the structured request."])
      )
    };
  } catch {
    return fallbackRecommendation(input);
  }
}

export async function structureIntent(
  text: string,
  model?: RecommendationModel
): Promise<StructuredIntentResult> {
  if (!model) return fallbackIntent(text);

  try {
    const raw = await model.run({
      system:
        "Return strict JSON for location, partySize, budget in paise, durationDays, durationNights, difficulty and requestedAddonCategories. Never return prices, approval or payment authority.",
      user: text.slice(0, 1_000)
    });
    const parsed = BookingIntentSchema.parse(responseValue(raw));
    return {
      source: "workers_ai",
      intent: { ...parsed, budget: money(parsed.budget) }
    };
  } catch {
    return fallbackIntent(text);
  }
}

export interface WorkersAiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export function createWorkersAiModel(
  ai: WorkersAiBinding,
  model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
): RecommendationModel {
  return {
    run: ({ system, user }) =>
      ai.run(model, {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        temperature: 0,
        max_tokens: 420
      })
  };
}
