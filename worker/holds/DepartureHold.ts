import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";

export interface HoldRequest {
  holdId: string;
  quoteId: string;
  seats: number;
  expiresAt: string;
}

export type HoldResult =
  | { status: "held"; holdId: string; expiresAt: string }
  | { status: "capacity_conflict"; available: number }
  | { status: "expired"; available: number };

interface CapacityState {
  capacity: number;
  holds: Record<string, HoldRequest>;
  bookings?: Record<string, HoldRequest>;
  reviewQuotes?: string[];
}

function removeExpired(state: CapacityState, now: number) {
  for (const [holdId, hold] of Object.entries(state.holds)) {
    if (Date.parse(hold.expiresAt) <= now) delete state.holds[holdId];
  }
}

function bookedSeats(state: CapacityState): number {
  return Object.values(state.bookings ?? {}).reduce((sum, booking) => sum + booking.seats, 0);
}

function heldSeats(state: CapacityState): number {
  return Object.values(state.holds).reduce((sum, hold) => sum + hold.seats, 0);
}

export class DepartureHold extends DurableObject<Env> {
  async configure(input: { capacity: number }): Promise<void> {
    if (!Number.isInteger(input.capacity) || input.capacity < 1) {
      throw new Error("capacity must be a positive integer");
    }
    await this.ctx.storage.transaction(async (transaction) => {
      const current = await transaction.get<CapacityState>("capacity");
      const state = current ?? { capacity: input.capacity, holds: {} };
      removeExpired(state, Date.now());
      if (Object.keys(state.holds).length === 0 && bookedSeats(state) === 0) state.capacity = input.capacity;
      await transaction.put("capacity", state);
    });
  }

  async reserve(input: HoldRequest): Promise<HoldResult> {
    if (!Number.isInteger(input.seats) || input.seats < 1) {
      throw new Error("seats must be a positive integer");
    }
    return this.ctx.storage.transaction(async (transaction) => {
      const state = (await transaction.get<CapacityState>("capacity")) ?? {
        capacity: 0,
        holds: {}
      };
      const now = Date.now();
      removeExpired(state, now);
      const available = Math.max(0, state.capacity - heldSeats(state) - bookedSeats(state));
      if (state.bookings?.[input.quoteId]) return { status: "expired" as const, available };
      const existing = state.holds[input.holdId];
      if (existing) {
        return {
          status: "held" as const,
          holdId: existing.holdId,
          expiresAt: existing.expiresAt
        };
      }
      if (Date.parse(input.expiresAt) <= now) {
        await transaction.put("capacity", state);
        return { status: "expired" as const, available };
      }
      if (available < input.seats) {
        await transaction.put("capacity", state);
        return { status: "capacity_conflict" as const, available };
      }
      state.holds[input.holdId] = input;
      await transaction.put("capacity", state);
      return {
        status: "held" as const,
        holdId: input.holdId,
        expiresAt: input.expiresAt
      };
    });
  }

  // A payment can outlive the checkout hold. Serialize confirmation against
  // competing reservations and never reclaim seats already sold to someone else.
  async confirm(input: HoldRequest): Promise<{ confirmed: boolean }> {
    if (!Number.isInteger(input.seats) || input.seats < 1) throw new Error("invalid seats");
    return this.ctx.storage.transaction(async (transaction) => {
      const state = await transaction.get<CapacityState>("capacity");
      if (!state) throw new Error("departure capacity is not configured");
      state.bookings ??= {};
      if (state.bookings[input.quoteId]) return { confirmed: true };
      if (state.reviewQuotes?.includes(input.quoteId)) return { confirmed: false };
      removeExpired(state, Date.now());
      const ownHold = state.holds[input.holdId];
      if (ownHold && (ownHold.quoteId !== input.quoteId || ownHold.seats !== input.seats)) {
        throw new Error("hold does not match payment quote");
      }
      const available = state.capacity - bookedSeats(state) - heldSeats(state) + (ownHold?.seats ?? 0);
      if (available < input.seats) {
        (state.reviewQuotes ??= []).push(input.quoteId);
        await transaction.put("capacity", state);
        return { confirmed: false };
      }
      delete state.holds[input.holdId];
      state.bookings[input.quoteId] = input;
      await transaction.put("capacity", state);
      return { confirmed: true };
    });
  }

  async release(holdId: string): Promise<{ released: boolean }> {
    return this.ctx.storage.transaction(async (transaction) => {
      const state = await transaction.get<CapacityState>("capacity");
      if (!state) return { released: false };
      removeExpired(state, Date.now());
      const released = Boolean(state.holds[holdId]);
      delete state.holds[holdId];
      await transaction.put("capacity", state);
      return { released };
    });
  }

  async getAvailability(): Promise<{
    capacity: number;
    heldSeats: number;
    bookedSeats: number;
    available: number;
  }> {
    return this.ctx.storage.transaction(async (transaction) => {
      const state = (await transaction.get<CapacityState>("capacity")) ?? {
        capacity: 0,
        holds: {}
      };
      removeExpired(state, Date.now());
      const held = heldSeats(state);
      await transaction.put("capacity", state);
      return {
        capacity: state.capacity,
        heldSeats: held,
        bookedSeats: bookedSeats(state),
        available: Math.max(0, state.capacity - held - bookedSeats(state))
      };
    });
  }
}
