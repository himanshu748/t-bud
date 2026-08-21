import type { RecommendationModel } from "../ai/recommendation";
import { recommendAddons, structureIntent } from "../ai/recommendation";
import type { AuditEvent } from "../audit/service";
import { approvalMatches, type Approval } from "./approval";
import { evaluateBundle } from "./policy";
import type { Addon, Departure, Quote, Trek } from "./types";

export interface BookingToolRepository {
  listActiveTreks(location: string): Promise<Trek[]>;
  listDepartures(trekId: string): Promise<Departure[]>;
  listActiveAddons(): Promise<Addon[]>;
  saveQuote(quote: Quote): Promise<void>;
  getQuote(id: string): Promise<Quote | null>;
  appendAudit(event: AuditEvent): Promise<void>;
}

export interface HoldService {
  create(input: { quote: Quote; sessionId: string }): Promise<unknown>;
}

export interface CheckoutService {
  create(input: { quote: Quote; sessionId: string }): Promise<unknown>;
}

export interface BookingToolsDependencies {
  repository: BookingToolRepository;
  model?: RecommendationModel;
  hold?: HoldService;
  checkout?: CheckoutService;
  id?: () => string;
  now?: () => Date;
}

export class BookingTools {
  private readonly id: () => string;
  private readonly now: () => Date;

  constructor(private readonly dependencies: BookingToolsDependencies) {
    this.id = dependencies.id ?? (() => crypto.randomUUID());
    this.now = dependencies.now ?? (() => new Date());
  }

  async searchTreks(input: { location: string; partySize: number }): Promise<Trek[]> {
    const treks = await this.dependencies.repository.listActiveTreks(input.location);
    const available: Trek[] = [];
    for (const trek of treks) {
      const departures = await this.dependencies.repository.listDepartures(trek.id);
      if (departures.some((departure) => departure.status === "active" && departure.available >= input.partySize)) {
        available.push(trek);
      }
    }
    return available;
  }

  async getAvailability(input: { trekId: string; partySize: number }): Promise<Departure[]> {
    const departures = await this.dependencies.repository.listDepartures(input.trekId);
    return departures.filter(
      (departure) => departure.status === "active" && departure.available >= input.partySize
    );
  }

  async quoteBundle(input: { taskId: string; text: string }): Promise<{
    quote: Quote;
    policy: ReturnType<typeof evaluateBundle>;
    intentSource: "workers_ai" | "rules_fallback";
    recommendationSource: "workers_ai" | "rules_fallback";
  }> {
    const structured = await structureIntent(input.text, this.dependencies.model);
    const treks = await this.dependencies.repository.listActiveTreks(structured.intent.location);
    const trek = treks.find(
      (candidate) =>
        candidate.durationDays === structured.intent.durationDays &&
        candidate.durationNights === structured.intent.durationNights
    );
    if (!trek) throw new Error("no eligible trek found");

    const departures = await this.getAvailability({
      trekId: trek.id,
      partySize: structured.intent.partySize
    });
    const departure = departures[0];
    if (!departure) throw new Error("no eligible departure found");

    const availableAddons = await this.dependencies.repository.listActiveAddons();
    const recommendation = await recommendAddons(
      { request: structured.intent, availableAddons },
      this.dependencies.model
    );
    const selected = recommendation.addonIds.flatMap((id) => {
      const addon = availableAddons.find((candidate) => candidate.id === id);
      return addon ? [addon] : [];
    });
    const policy = evaluateBundle(structured.intent, trek, selected);
    const createdAt = this.now();
    const quote: Quote = {
      id: this.id(),
      taskId: input.taskId,
      version: 1,
      trekId: trek.id,
      departureId: departure.id,
      partySize: structured.intent.partySize,
      budget: structured.intent.budget,
      currency: "INR",
      items: policy.items,
      total: policy.total,
      expiresAt: new Date(createdAt.getTime() + 15 * 60_000).toISOString(),
      status: "ready"
    };
    await this.dependencies.repository.saveQuote(quote);
    await this.dependencies.repository.appendAudit({
      id: this.id(),
      taskId: input.taskId,
      actor: "merchant_agent",
      action: "quote.created",
      target: quote.id,
      payload: {
        intentSource: structured.source,
        recommendationSource: recommendation.source,
        addonIds: recommendation.addonIds,
        total: quote.total,
        budgetStatus: policy.status
      },
      result: "recorded",
      createdAt: createdAt.toISOString()
    });

    return {
      quote,
      policy,
      intentSource: structured.source,
      recommendationSource: recommendation.source
    };
  }

  async requestHold(input: {
    quote: Quote;
    approval: Approval | null;
    sessionId: string;
  }): Promise<unknown> {
    if (!input.approval || input.approval.gate !== "itinerary") {
      throw new Error("itinerary approval required");
    }
    if (!(await approvalMatches(input.approval, input.quote, input.sessionId))) {
      throw new Error("approval does not match this session and quote");
    }
    if (!this.dependencies.hold) throw new Error("hold service unavailable");
    return this.dependencies.hold.create({ quote: input.quote, sessionId: input.sessionId });
  }

  async createCheckout(input: {
    quote: Quote;
    approval: Approval | null;
    sessionId: string;
  }): Promise<unknown> {
    if (!input.approval || input.approval.gate !== "payment") {
      throw new Error("payment approval required");
    }
    if (!(await approvalMatches(input.approval, input.quote, input.sessionId))) {
      throw new Error("approval does not match this session and quote");
    }
    if (!this.dependencies.checkout) throw new Error("checkout service unavailable");
    return this.dependencies.checkout.create({ quote: input.quote, sessionId: input.sessionId });
  }
}
