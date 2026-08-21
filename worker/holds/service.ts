import type { D1BookingRepository, HoldRecord } from "../data/repository";
import type { HoldService } from "../domain/tools";
import type { Quote } from "../domain/types";
import type { Env } from "../env";
import type { HoldResult } from "./DepartureHold";

export class DepartureHoldService implements HoldService {
  constructor(
    private readonly env: Env,
    private readonly repository: D1BookingRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async create(input: {
    quote: Quote;
    sessionId: string;
  }): Promise<HoldResult> {
    const existing = await this.repository.getActiveHoldByQuote(input.quote.id);
    if (existing && Date.parse(existing.expiresAt) > this.now().getTime()) {
      return {
        status: "held",
        holdId: existing.id,
        expiresAt: existing.expiresAt
      };
    }

    const quoteExpiry = Date.parse(input.quote.expiresAt);
    if (quoteExpiry <= this.now().getTime()) {
      return { status: "expired", available: 0 };
    }
    const departure = (await this.repository.listDepartures(input.quote.trekId)).find(
      (candidate) => candidate.id === input.quote.departureId
    );
    if (!departure || departure.status !== "active") {
      return { status: "capacity_conflict", available: 0 };
    }

    const holdId = crypto.randomUUID();
    const expiresAt = new Date(
      Math.min(quoteExpiry, this.now().getTime() + 10 * 60_000)
    ).toISOString();
    const stub = this.env.DEPARTURE_HOLD.getByName(input.quote.departureId);
    await stub.configure({ capacity: departure.capacity });
    const result = await stub.reserve({
      holdId,
      quoteId: input.quote.id,
      seats: input.quote.partySize,
      expiresAt
    });
    if (result.status !== "held") return result;

    const record: HoldRecord = {
      id: holdId,
      departureId: input.quote.departureId,
      quoteId: input.quote.id,
      partySize: input.quote.partySize,
      holdToken: crypto.randomUUID(),
      expiresAt,
      status: "held"
    };
    await this.repository.saveHold(record);
    await this.repository.appendAudit({
      id: crypto.randomUUID(),
      taskId: input.quote.taskId,
      actor: "merchant_agent",
      action: "hold.created",
      target: holdId,
      payload: {
        quoteId: input.quote.id,
        partySize: input.quote.partySize,
        expiresAt
      },
      result: "accepted",
      createdAt: this.now().toISOString()
    });
    return result;
  }
}
