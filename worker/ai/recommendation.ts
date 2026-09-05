import { z } from "zod";
import { money } from "../domain/money";
import type { Addon, BookingRequest } from "../domain/types";

const RecommendationSchema = z
  .object({
    addonIds: z.array(z.string().max(80)).max(3),
    // An open object avoids propertyNames, which Workers AI JSON mode cannot compile.
    reasons: z.object({}).catchall(z.string().max(180))
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
  run(input: { system: string; user: string; schema?: Record<string, unknown> }): Promise<unknown>;
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
  if (typeof raw === "string") {
    const fenced = raw.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return JSON.parse(fenced ? fenced[1]! : raw) as unknown;
  }
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

export class UnclearIntentError extends Error {}

function explicitIntent(text: string) {
  const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  const normalized = text.toLowerCase().replace(
    new RegExp(`\\b(${words.join("|")})\\b`, "g"),
    (word) => String(words.indexOf(word))
  );
  const parties = [
    ...normalized.matchAll(/\b(\d{1,2})\s+(?:people|persons|friends|hikers|travellers|travelers)\b/g),
    ...normalized.matchAll(/\b(?:party of|group of)\s+(\d{1,2})\b/g),
    ...normalized.matchAll(/\bfor\s+(\d{1,2})(?![\d.,])\b(?!\s*[- ]?\s*(?:days?|nights?)\b)/g)
  ];
  const partySizes = [...new Set(parties.map((match) => Number(match[1])))];
  if (partySizes.length !== 1 || partySizes[0]! < 1 || partySizes[0]! > 12) {
    throw new UnclearIntentError("State one group size from 1 to 12 people, for example ‘for six people’.");
  }
  const budgets = [...normalized.matchAll(/(?:₹|\brs\.?|\binr)\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(k\b|thousand\b)?/g)]
    .map((match) => Math.round(Number(match[1]!.replaceAll(",", "")) * (match[2] ? 1000 : 1) * 100));
  if (budgets.length !== 1 || !Number.isSafeInteger(budgets[0]) || budgets[0]! <= 0 || /per (?:person|head)|each/.test(normalized)) {
    throw new UnclearIntentError("State one total group budget in INR, for example ‘total budget INR 30,000’.");
  }
  return { normalized, partySize: partySizes[0]!, budget: money(budgets[0]!) };
}

function fallbackIntent(text: string): StructuredIntentResult {
  const { normalized, partySize, budget } = explicitIntent(text);
  if (!/\bmanali\b/.test(normalized)) {
    throw new UnclearIntentError("This pilot supports Manali. Include the destination in your request.");
  }
  const days = Number(normalized.match(/(\d+)\s*[- ]?day/)?.[1] ?? 2);
  const nights = Number(normalized.match(/(\d+)\s*[- ]?night/)?.[1] ?? Math.max(0, days - 1));
  const requests = (word: string) => new RegExp(`\\b${word}`).test(normalized)
    && !new RegExp(`(?:no|without|skip)\\s+(?:(?:pickup|meals?)\\s+and\\s+)?(?:upgraded\\s+)?${word}`).test(normalized);
  const parsed = BookingIntentSchema.parse({
    location: "Manali", partySize, budget,
    durationDays: days, durationNights: nights,
    difficulty: /\beasy\b/.test(normalized) ? "easy" : /\bhard\b/.test(normalized) ? "hard" : "moderate",
    requestedAddonCategories: [
      ...(requests("pickup") ? ["pickup"] : []),
      ...(requests("meal") ? ["meals"] : [])
    ]
  });
  return { source: "rules_fallback", intent: { ...parsed, budget } };
}

export async function recommendAddons(
  input: RecommendationInput,
  model?: RecommendationModel
): Promise<RecommendationResult> {
  if (!model) return fallbackRecommendation(input);

  try {
    const raw = await model.run({
      system:
        "Return JSON matching the schema. Recommend one supplied ID per requested category, preferring the lowest price. Reasons is an object mapping each selected ID to a short explanation. Never invent prices or approval state.",
      schema: z.toJSONSchema(RecommendationSchema),
      user: JSON.stringify({
        request: input.request,
        availableAddons: input.availableAddons.map((addon) => ({
          id: addon.id,
          category: addon.category,
          scope: addon.scope,
          unitAmount: addon.unitAmount
        }))
      })
    });
    const parsed = RecommendationSchema.parse(responseValue(raw));
    const allowed = new Set(input.availableAddons.filter((addon) => addon.active && input.request.requestedAddonCategories.includes(addon.category)).map((addon) => addon.id));
    const addonIds = [...new Set(parsed.addonIds)].filter((id) => allowed.has(id));
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
  const explicit = explicitIntent(text);
  if (!model) return fallbackIntent(text);

  try {
    const raw = await model.run({
      system:
        "Return JSON matching the schema. Structure the trek request. Budget is total INR paise (rupees times 100). Difficulty is easy, moderate or hard; occasional hikers means moderate. The only supported add-on categories are pickup and meals. Include only explicitly requested categories, never accommodation, food or guide. Never return prices, approval or payment authority.",
      schema: z.toJSONSchema(BookingIntentSchema),
      user: JSON.stringify({ text: text.slice(0, 1_000), confirmedPartySize: explicit.partySize, confirmedBudgetPaise: explicit.budget })
    });
    const parsed = BookingIntentSchema.parse(responseValue(raw));
    return {
      source: "workers_ai",
      intent: { ...parsed, partySize: explicit.partySize, budget: explicit.budget }
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
    run: ({ system, user, schema }) =>
      ai.run(model, {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        temperature: 0,
        max_tokens: 700,
        ...(schema ? { response_format: { type: "json_schema", json_schema: schema } } : {})
      })
  };
}
