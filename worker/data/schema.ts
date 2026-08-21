import { money } from "../domain/money";
import type {
  Departure,
  Quote,
  QuoteItem,
  Trek
} from "../domain/types";

export interface TrekRow {
  id: string;
  name: string;
  location: string;
  duration_days: number;
  duration_nights: number;
  difficulty: Trek["difficulty"];
  unit_amount: number;
  active: number;
}

export interface DepartureRow {
  id: string;
  trek_id: string;
  start_at: string;
  capacity: number;
  available: number;
  status: Departure["status"];
}

export interface QuoteRow {
  id: string;
  task_id: string;
  version: number;
  trek_id: string;
  departure_id: string;
  party_size: number;
  budget: number;
  currency: "INR";
  total: number;
  expires_at: string;
  status: Quote["status"];
}

export interface QuoteItemRow {
  item_id: string;
  kind: QuoteItem["kind"];
  name: string;
  quantity: number;
  unit_amount: number;
  amount: number;
}

export function mapTrek(row: TrekRow): Trek {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    durationDays: row.duration_days,
    durationNights: row.duration_nights,
    difficulty: row.difficulty,
    unitAmount: money(row.unit_amount),
    active: row.active === 1
  };
}

export function mapDeparture(row: DepartureRow): Departure {
  return {
    id: row.id,
    trekId: row.trek_id,
    startAt: row.start_at,
    capacity: row.capacity,
    available: row.available,
    status: row.status
  };
}

export function mapQuote(row: QuoteRow, itemRows: QuoteItemRow[]): Quote {
  return {
    id: row.id,
    taskId: row.task_id,
    version: row.version,
    trekId: row.trek_id,
    departureId: row.departure_id,
    partySize: row.party_size,
    budget: money(row.budget),
    currency: row.currency,
    items: itemRows.map((item) => ({
      id: item.item_id,
      kind: item.kind,
      name: item.name,
      quantity: item.quantity,
      unitAmount: money(item.unit_amount),
      amount: money(item.amount)
    })),
    total: money(row.total),
    expiresAt: row.expires_at,
    status: row.status
  };
}
