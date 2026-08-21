import { env } from "cloudflare:workers";

const future = "2099-09-12T12:15:00.000Z";

it("allows only one four-seat hold when four seats remain", async () => {
  const stub = env.DEPARTURE_HOLD.getByName(`race-${crypto.randomUUID()}`);
  await stub.configure({ capacity: 4 });

  const [first, second] = await Promise.all([
    stub.reserve({ holdId: "hold_a", quoteId: "quote_a", seats: 4, expiresAt: future }),
    stub.reserve({ holdId: "hold_b", quoteId: "quote_b", seats: 4, expiresAt: future })
  ]);

  expect([first.status, second.status].sort()).toEqual([
    "capacity_conflict",
    "held"
  ]);
});

it("makes same-hold retries idempotent and restores released capacity", async () => {
  const stub = env.DEPARTURE_HOLD.getByName(`retry-${crypto.randomUUID()}`);
  await stub.configure({ capacity: 4 });
  const request = {
    holdId: "hold_retry",
    quoteId: "quote_retry",
    seats: 4,
    expiresAt: future
  };

  const first = await stub.reserve(request);
  const retried = await stub.reserve(request);
  expect(retried).toEqual(first);
  await stub.release(request.holdId);
  await expect(stub.getAvailability()).resolves.toMatchObject({ available: 4 });
});

it("does not count expired holds against availability", async () => {
  const stub = env.DEPARTURE_HOLD.getByName(`expiry-${crypto.randomUUID()}`);
  await stub.configure({ capacity: 4 });
  await stub.reserve({
    holdId: "hold_expired",
    quoteId: "quote_expired",
    seats: 4,
    expiresAt: "2000-01-01T00:00:00.000Z"
  });

  await expect(stub.getAvailability()).resolves.toMatchObject({
    available: 4,
    heldSeats: 0
  });
});
