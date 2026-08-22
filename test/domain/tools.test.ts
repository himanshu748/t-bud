import { describe, expect, it, vi } from "vitest";
import { quoteDigest, type Approval } from "../../worker/domain/approval";
import { money } from "../../worker/domain/money";
import { BookingTools, type BookingToolRepository } from "../../worker/domain/tools";
import type { Addon, Departure, Quote, Trek } from "../../worker/domain/types";

const trek: Trek = {
  id: "trek_hampta",
  name: "Hampta Pass Intro Trek",
  location: "Manali",
  durationDays: 2,
  durationNights: 1,
  difficulty: "moderate",
  unitAmount: money(400_000),
  active: true
};

const departure: Departure = {
  id: "dep_hampta_2026_09_12",
  trekId: trek.id,
  startAt: "2099-09-12T06:30:00.000Z",
  capacity: 4,
  available: 4,
  status: "active"
};

const addons: Addon[] = [
  { id: "pickup_manali", name: "Manali pickup", category: "pickup", scope: "per_booking", unitAmount: money(200_000), active: true },
  { id: "meals_budget", name: "Upgraded trail meals", category: "meals", scope: "per_person", unitAmount: money(40_000), active: true }
];

function repository(): BookingToolRepository {
  return {
    listActiveTreks: vi.fn().mockResolvedValue([trek]),
    listDepartures: vi.fn().mockResolvedValue([departure]),
    listActiveAddons: vi.fn().mockResolvedValue(addons),
    saveQuote: vi.fn().mockResolvedValue(undefined),
    getQuote: vi.fn(),
    appendAudit: vi.fn().mockResolvedValue(undefined)
  };
}

describe("BookingTools", () => {
  it("quotes only authoritative catalog prices", async () => {
    const repo = repository();
    const tools = new BookingTools({
      repository: repo,
      model: {
        run: vi.fn().mockResolvedValue({
          response: JSON.stringify({
            addonIds: ["pickup_manali", "meals_budget"],
            reasons: {},
            price: 1
          })
        })
      },
      id: () => "quote_test"
    });

    const result = await tools.quoteBundle({
      taskId: "task_test",
      text: "2-day Manali trek for four friends under ₹20,000 with pickup and upgraded meals"
    });

    expect(result.quote.total).toBe(1_960_000);
    expect(result.quote.items.map((item) => item.unitAmount)).toEqual([
      400_000,
      200_000,
      40_000
    ]);
    expect(repo.saveQuote).toHaveBeenCalledOnce();
  });

  it("rejects a hold before a separate seat-hold approval", async () => {
    const hold = vi.fn();
    const tools = new BookingTools({ repository: repository(), hold: { create: hold } });

    await expect(
      tools.requestHold({ quote: quote(), approval: null, sessionId: "session-a" })
    ).rejects.toThrow("seat-hold approval required");
    expect(hold).not.toHaveBeenCalled();
  });

  it("rejects a session-mismatched approval before a hold", async () => {
    const hold = vi.fn();
    const approvedQuote = quote();
    const approval: Approval = {
      quoteId: approvedQuote.id,
      quoteVersion: approvedQuote.version,
      actorSessionId: "session-b",
      gate: "hold",
      digest: await quoteDigest(approvedQuote, "session-b"),
      approvedAt: new Date().toISOString()
    };
    const tools = new BookingTools({ repository: repository(), hold: { create: hold } });

    await expect(
      tools.requestHold({ quote: approvedQuote, approval, sessionId: "session-a" })
    ).rejects.toThrow("approval does not match this session and quote");
    expect(hold).not.toHaveBeenCalled();
  });

  it("rejects an over-budget quote even with a matching hold approval", async () => {
    const hold = vi.fn();
    const overBudgetQuote = {
      ...quote(),
      budget: money(1_900_000),
      total: money(1_960_000)
    };
    const approval: Approval = {
      quoteId: overBudgetQuote.id,
      quoteVersion: overBudgetQuote.version,
      actorSessionId: "session-a",
      gate: "hold",
      digest: await quoteDigest(overBudgetQuote, "session-a"),
      approvedAt: new Date().toISOString()
    };
    const tools = new BookingTools({ repository: repository(), hold: { create: hold } });

    await expect(
      tools.requestHold({
        quote: overBudgetQuote,
        approval,
        sessionId: "session-a"
      })
    ).rejects.toThrow("exceeds the approved budget ceiling");
    expect(hold).not.toHaveBeenCalled();
  });
});

function quote(): Quote {
  return {
    id: "quote_test",
    taskId: "task_test",
    version: 2,
    trekId: trek.id,
    departureId: departure.id,
    partySize: 4,
    budget: money(2_000_000),
    currency: "INR",
    items: [],
    total: money(1_960_000),
    expiresAt: "2099-09-12T12:15:00.000Z",
    status: "ready"
  };
}
