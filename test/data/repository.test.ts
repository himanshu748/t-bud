import { env } from "cloudflare:workers";
import { money } from "../../worker/domain/money";
import type { Quote } from "../../worker/domain/types";
import { D1BookingRepository } from "../../worker/data/repository";

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
    },
    {
      id: "pickup_manali",
      kind: "addon",
      name: "Manali pickup",
      quantity: 1,
      unitAmount: money(200_000),
      amount: money(200_000)
    }
  ],
  total: money(1_800_000),
  expiresAt: "2099-09-12T06:30:00.000Z",
  status: "ready"
};

it("persists a quote with ordered items and audit evidence", async () => {
  const repository = new D1BookingRepository(env.DB);
  await repository.createTask({
    id: "task_1",
    contextId: "context_1",
    state: "quote_ready",
    request: { partySize: 4 },
    createdAt: "2026-08-21T12:00:00.000Z",
    updatedAt: "2026-08-21T12:00:00.000Z"
  });
  await repository.saveQuote(quote);
  await repository.appendAudit({
    id: "evt_1",
    taskId: quote.taskId,
    actor: "merchant_agent",
    action: "quote.created",
    target: quote.id,
    payload: { total: quote.total },
    result: "recorded",
    createdAt: "2026-08-21T12:00:01.000Z"
  });

  await expect(repository.getQuote(quote.id)).resolves.toEqual(quote);
  await expect(repository.listAudit(quote.taskId)).resolves.toEqual([
    expect.objectContaining({ id: "evt_1", payload: { total: 1_800_000 } })
  ]);
});

it("loads the seeded Manali trek inventory", async () => {
  const repository = new D1BookingRepository(env.DB);

  await expect(repository.listActiveTreks("Manali")).resolves.toEqual([
    expect.objectContaining({
      id: "trek_hampta",
      unitAmount: 400_000,
      difficulty: "moderate"
    })
  ]);
  await expect(
    repository.listDepartures("trek_hampta")
  ).resolves.toHaveLength(2);
});
