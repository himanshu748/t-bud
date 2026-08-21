import {
  approvalMatches,
  quoteDigest,
  type Approval
} from "../../worker/domain/approval";
import { money } from "../../worker/domain/money";
import type { Quote } from "../../worker/domain/types";

const quote: Quote = {
  id: "quote_1",
  taskId: "task_1",
  version: 1,
  trekId: "trek_hampta",
  departureId: "dep_hampta_2026_09_12",
  partySize: 4,
  budget: money(2_000_000),
  currency: "INR",
  items: [
    {
      id: "trek_hampta",
      kind: "trek",
      name: "Hampta Pass Intro Trek",
      quantity: 4,
      unitAmount: money(400_000),
      amount: money(1_600_000)
    }
  ],
  total: money(1_600_000),
  expiresAt: "2099-09-12T06:30:00.000Z",
  status: "ready"
};

async function approvedQuote(): Promise<Approval> {
  return {
    quoteId: quote.id,
    quoteVersion: quote.version,
    actorSessionId: "session_a",
    gate: "itinerary",
    digest: await quoteDigest(quote, "session_a"),
    approvedAt: "2026-08-21T12:00:00.000Z"
  };
}

it("accepts the exact quote for the approving session", async () => {
  await expect(
    approvalMatches(await approvedQuote(), quote, "session_a")
  ).resolves.toBe(true);
});

it("invalidates approval when the quote version changes", async () => {
  await expect(
    approvalMatches(
      await approvedQuote(),
      { ...quote, version: 2 },
      "session_a"
    )
  ).resolves.toBe(false);
});

it("invalidates approval when the actor session changes", async () => {
  await expect(
    approvalMatches(await approvedQuote(), quote, "session_b")
  ).resolves.toBe(false);
});

it("invalidates approval when an approved amount changes", async () => {
  await expect(
    approvalMatches(
      await approvedQuote(),
      { ...quote, total: money(1_700_000) },
      "session_a"
    )
  ).resolves.toBe(false);
});

it("invalidates approval after quote expiry", async () => {
  await expect(
    approvalMatches(
      await approvedQuote(),
      { ...quote, expiresAt: "2020-01-01T00:00:00.000Z" },
      "session_a"
    )
  ).resolves.toBe(false);
});
