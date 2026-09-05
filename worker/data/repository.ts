import type { AuditEvent } from "../audit/service";
import type { Approval, ApprovalGate } from "../domain/approval";
import type { Addon, Departure, Quote, Trek } from "../domain/types";
import {
  mapAddon,
  mapDeparture,
  mapQuote,
  mapTrek,
  type AddonRow,
  type DepartureRow,
  type QuoteItemRow,
  type QuoteRow,
  type TrekRow
} from "./schema";

export interface TaskRecord {
  id: string;
  contextId: string;
  state: string;
  request: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface HoldRecord {
  id: string;
  departureId: string;
  quoteId: string;
  partySize: number;
  holdToken: string;
  expiresAt: string;
  status: "held" | "released" | "expired";
}

export interface OrderRecord {
  id: string;
  quoteId: string;
  razorpayOrderId: string;
  amount: number;
  paymentId: string | null;
  verificationStatus: "created" | "verified" | "failed";
  createdAt: string;
  updatedAt: string;
}

export interface DepartureOverview {
  id: string;
  trekName: string;
  startAt: string;
  capacity: number;
  available: number;
  status: Departure["status"];
}

interface AuditRow {
  id: string;
  task_id: string;
  actor: AuditEvent["actor"];
  action: string;
  target: string;
  payload_json: string;
  result: AuditEvent["result"];
  created_at: string;
}

export interface BookingRepository {
  createTask(task: TaskRecord): Promise<void>;
  getTask(id: string): Promise<TaskRecord | null>;
  updateTask(task: TaskRecord): Promise<void>;
  saveQuote(quote: Quote): Promise<void>;
  getQuote(id: string): Promise<Quote | null>;
  listActiveTreks(location: string): Promise<Trek[]>;
  listDepartures(trekId: string): Promise<Departure[]>;
  listActiveAddons(): Promise<Addon[]>;
  saveApproval(id: string, approval: Approval): Promise<void>;
  getApproval(quoteId: string, gate: ApprovalGate): Promise<Approval | null>;
  saveHold(hold: HoldRecord): Promise<void>;
  updateHoldStatus(id: string, status: HoldRecord["status"]): Promise<void>;
  getActiveHoldByQuote(quoteId: string): Promise<HoldRecord | null>;
  getHold(id: string): Promise<HoldRecord | null>;
  saveOrder(order: OrderRecord): Promise<void>;
  getOrderByQuote(quoteId: string): Promise<OrderRecord | null>;
  getOrderByGatewayId(razorpayOrderId: string): Promise<OrderRecord | null>;
  markOrderVerified(razorpayOrderId: string, paymentId: string): Promise<void>;
  recordPaymentEvent(eventId: string, eventType: string, processedAt: string): Promise<boolean>;
  appendAudit(event: AuditEvent): Promise<void>;
  listAudit(taskId: string): Promise<AuditEvent[]>;
}

export class D1BookingRepository implements BookingRepository {
  constructor(private readonly db: D1Database) {}

  async createTask(task: TaskRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO a2a_tasks
          (id, context_id, state, request_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        task.id,
        task.contextId,
        task.state,
        JSON.stringify(task.request),
        task.createdAt,
        task.updatedAt
      )
      .run();
  }

  async getTask(id: string): Promise<TaskRecord | null> {
    const row = await this.db
      .prepare("SELECT * FROM a2a_tasks WHERE id = ?")
      .bind(id)
      .first<{
        id: string;
        context_id: string;
        state: string;
        request_json: string;
        created_at: string;
        updated_at: string;
      }>();
    if (!row) return null;

    return {
      id: row.id,
      contextId: row.context_id,
      state: row.state,
      request: JSON.parse(row.request_json) as Record<string, unknown>,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async updateTask(task: TaskRecord): Promise<void> {
    await this.db
      .prepare(
        `UPDATE a2a_tasks
         SET context_id = ?, state = ?, request_json = ?, updated_at = ?
         WHERE id = ? AND state NOT IN ('paid', 'payment_review')`
      )
      .bind(
        task.contextId,
        task.state,
        JSON.stringify(task.request),
        task.updatedAt,
        task.id
      )
      .run();
  }

  async saveQuote(quote: Quote): Promise<void> {
    const statements = [
      this.db
        .prepare(
          `INSERT INTO quotes
            (id, task_id, version, trek_id, departure_id, party_size, budget,
             currency, total, expires_at, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          quote.id,
          quote.taskId,
          quote.version,
          quote.trekId,
          quote.departureId,
          quote.partySize,
          quote.budget,
          quote.currency,
          quote.total,
          quote.expiresAt,
          quote.status
        ),
      ...quote.items.map((item, position) =>
        this.db
          .prepare(
            `INSERT INTO quote_items
              (quote_id, position, item_id, kind, name, quantity, unit_amount, amount)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            quote.id,
            position,
            item.id,
            item.kind,
            item.name,
            item.quantity,
            item.unitAmount,
            item.amount
          )
      )
    ];

    await this.db.batch(statements);
  }

  async getQuote(id: string): Promise<Quote | null> {
    const row = await this.db
      .prepare("SELECT * FROM quotes WHERE id = ?")
      .bind(id)
      .first<QuoteRow>();
    if (!row) return null;

    const items = await this.db
      .prepare(
        `SELECT item_id, kind, name, quantity, unit_amount, amount
         FROM quote_items WHERE quote_id = ? ORDER BY position`
      )
      .bind(id)
      .all<QuoteItemRow>();

    return mapQuote(row, items.results);
  }

  async refreshQuoteExpiry(id: string, expiresAt: string): Promise<void> {
    await this.db
      .prepare("UPDATE quotes SET expires_at = ?, status = 'ready' WHERE id = ?")
      .bind(expiresAt, id)
      .run();
  }

  async listActiveTreks(location: string): Promise<Trek[]> {
    const rows = await this.db
      .prepare(
        `SELECT id, name, location, duration_days, duration_nights, difficulty,
                unit_amount, active
         FROM treks WHERE active = 1 AND location = ? ORDER BY name`
      )
      .bind(location)
      .all<TrekRow>();
    return rows.results.map(mapTrek);
  }

  async listDepartures(trekId: string): Promise<Departure[]> {
    const rows = await this.db
      .prepare(
        `SELECT id, trek_id, start_at, capacity, available, status
         FROM departures WHERE trek_id = ? AND status = 'active' ORDER BY start_at`
      )
      .bind(trekId)
      .all<DepartureRow>();
    return rows.results.map(mapDeparture);
  }

  async listActiveAddons(): Promise<Addon[]> {
    const rows = await this.db
      .prepare(
        `SELECT id, name, category, scope, unit_amount, active
         FROM addons WHERE active = 1 ORDER BY category, unit_amount, id`
      )
      .all<AddonRow>();
    return rows.results.map(mapAddon);
  }

  async saveApproval(id: string, approval: Approval): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO approvals
          (id, quote_id, quote_version, gate, actor_session_id, digest, approved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(quote_id, gate) DO UPDATE SET
           id = excluded.id,
           quote_version = excluded.quote_version,
           actor_session_id = excluded.actor_session_id,
           digest = excluded.digest,
           approved_at = excluded.approved_at`
      )
      .bind(
        id,
        approval.quoteId,
        approval.quoteVersion,
        approval.gate,
        approval.actorSessionId,
        approval.digest,
        approval.approvedAt
      )
      .run();
  }

  async getApproval(quoteId: string, gate: ApprovalGate): Promise<Approval | null> {
    const row = await this.db
      .prepare(
        `SELECT id, quote_id, quote_version, gate, actor_session_id, digest, approved_at
         FROM approvals WHERE quote_id = ? AND gate = ?`
      )
      .bind(quoteId, gate)
      .first<{
        id: string;
        quote_id: string;
        quote_version: number;
        gate: ApprovalGate;
        actor_session_id: string;
        digest: string;
        approved_at: string;
      }>();
    if (!row) return null;
    return {
      recordId: row.id,
      quoteId: row.quote_id,
      quoteVersion: row.quote_version,
      gate: row.gate,
      actorSessionId: row.actor_session_id,
      digest: row.digest,
      approvedAt: row.approved_at
    };
  }

  async saveHold(hold: HoldRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO holds
          (id, departure_id, quote_id, party_size, hold_token, expires_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        hold.id,
        hold.departureId,
        hold.quoteId,
        hold.partySize,
        hold.holdToken,
        hold.expiresAt,
        hold.status
      )
      .run();
  }

  async updateHoldStatus(
    id: string,
    status: HoldRecord["status"]
  ): Promise<void> {
    await this.db
      .prepare("UPDATE holds SET status = ? WHERE id = ?")
      .bind(status, id)
      .run();
  }

  async getActiveHoldByQuote(quoteId: string): Promise<HoldRecord | null> {
    const row = await this.db
      .prepare(
        `SELECT id, departure_id, quote_id, party_size, hold_token, expires_at, status
         FROM holds WHERE quote_id = ? AND status = 'held' ORDER BY expires_at DESC LIMIT 1`
      )
      .bind(quoteId)
      .first<{
        id: string;
        departure_id: string;
        quote_id: string;
        party_size: number;
        hold_token: string;
        expires_at: string;
        status: HoldRecord["status"];
      }>();
    if (!row) return null;
    return {
      id: row.id,
      departureId: row.departure_id,
      quoteId: row.quote_id,
      partySize: row.party_size,
      holdToken: row.hold_token,
      expiresAt: row.expires_at,
      status: row.status
    };
  }

  async getHold(id: string): Promise<HoldRecord | null> {
    const row = await this.db
      .prepare(
        `SELECT id, departure_id, quote_id, party_size, hold_token, expires_at, status
         FROM holds WHERE id = ?`
      )
      .bind(id)
      .first<{
        id: string;
        departure_id: string;
        quote_id: string;
        party_size: number;
        hold_token: string;
        expires_at: string;
        status: HoldRecord["status"];
      }>();
    if (!row) return null;
    return {
      id: row.id,
      departureId: row.departure_id,
      quoteId: row.quote_id,
      partySize: row.party_size,
      holdToken: row.hold_token,
      expiresAt: row.expires_at,
      status: row.status
    };
  }

  async saveOrder(order: OrderRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO orders
          (id, quote_id, razorpay_order_id, amount, payment_id,
           verification_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        order.id,
        order.quoteId,
        order.razorpayOrderId,
        order.amount,
        order.paymentId,
        order.verificationStatus,
        order.createdAt,
        order.updatedAt
      )
      .run();
  }

  private async getOrder(where: "quote_id" | "razorpay_order_id", value: string) {
    const row = await this.db
      .prepare(
        `SELECT id, quote_id, razorpay_order_id, amount, payment_id,
                verification_status, created_at, updated_at
         FROM orders WHERE ${where} = ?`
      )
      .bind(value)
      .first<{
        id: string;
        quote_id: string;
        razorpay_order_id: string;
        amount: number;
        payment_id: string | null;
        verification_status: OrderRecord["verificationStatus"];
        created_at: string;
        updated_at: string;
      }>();
    if (!row) return null;
    return {
      id: row.id,
      quoteId: row.quote_id,
      razorpayOrderId: row.razorpay_order_id,
      amount: row.amount,
      paymentId: row.payment_id,
      verificationStatus: row.verification_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } satisfies OrderRecord;
  }

  getOrderByQuote(quoteId: string): Promise<OrderRecord | null> {
    return this.getOrder("quote_id", quoteId);
  }

  getOrderByGatewayId(razorpayOrderId: string): Promise<OrderRecord | null> {
    return this.getOrder("razorpay_order_id", razorpayOrderId);
  }

  async markOrderVerified(razorpayOrderId: string, paymentId: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE orders SET payment_id = ?, verification_status = 'verified', updated_at = ?
         WHERE razorpay_order_id = ? AND verification_status != 'verified'`
      )
      .bind(paymentId, new Date().toISOString(), razorpayOrderId)
      .run();
  }

  async getPaymentSettlement(quoteId: string): Promise<{ status: "confirmed" | "review" } | null> {
    return this.db.prepare("SELECT status FROM payment_settlements WHERE quote_id = ?")
      .bind(quoteId).first<{ status: "confirmed" | "review" }>();
  }

  async getLatestHoldByQuote(quoteId: string): Promise<HoldRecord | null> {
    const row = await this.db.prepare("SELECT id FROM holds WHERE quote_id = ? ORDER BY expires_at DESC LIMIT 1")
      .bind(quoteId).first<{ id: string }>();
    return row ? this.getHold(row.id) : null;
  }

  async settlePayment(input: {
    quote: Quote; hold: HoldRecord; order: OrderRecord; paymentId: string;
    confirmed: boolean; source: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    const status = input.confirmed ? "confirmed" : "review";
    // The DO reservation is idempotent; this atomic batch can safely be retried
    // if D1 fails after the DO has committed the seats.
    await this.db.batch([
      this.db.prepare("INSERT OR IGNORE INTO payment_settlements (quote_id, hold_id, status, created_at) VALUES (?, ?, ?, ?)")
        .bind(input.quote.id, input.hold.id, status, now),
      this.db.prepare("UPDATE orders SET payment_id = ?, verification_status = 'verified', updated_at = ? WHERE id = ?")
        .bind(input.paymentId, now, input.order.id),
      this.db.prepare("UPDATE holds SET status = 'released' WHERE id = ?").bind(input.hold.id),
      this.db.prepare("UPDATE a2a_tasks SET state = ?, updated_at = ? WHERE id = ?")
        .bind(input.confirmed ? "paid" : "payment_review", now, input.quote.taskId),
      this.db.prepare("UPDATE quotes SET status = 'approved' WHERE id = ?").bind(input.quote.id),
      this.db.prepare(`INSERT OR IGNORE INTO audit_events
        (id, task_id, actor, action, target, payload_json, result, created_at)
        VALUES (?, ?, 'system', 'payment.verified', ?, ?, 'accepted', ?)`)
        .bind(`payment:${input.order.id}`, input.quote.taskId, input.order.id,
          JSON.stringify({ source: input.source, bookingStatus: status }), now),
      this.db.prepare(`INSERT OR IGNORE INTO audit_events
        (id, task_id, actor, action, target, payload_json, result, created_at)
        VALUES (?, ?, 'system', ?, ?, ?, ?, ?)`)
        .bind(`booking:${input.order.id}`, input.quote.taskId,
          input.confirmed ? "booking.confirmed" : "booking.review_required", input.quote.id,
          JSON.stringify({ holdId: input.hold.id }), input.confirmed ? "accepted" : "rejected", now)
    ]);
  }

  async expireUnpaidHold(hold: HoldRecord, taskId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.batch([
      this.db.prepare(`UPDATE holds SET status = 'expired' WHERE id = ? AND status = 'held'
        AND NOT EXISTS (SELECT 1 FROM payment_settlements WHERE quote_id = ?)`)
        .bind(hold.id, hold.quoteId),
      this.db.prepare("UPDATE a2a_tasks SET state = 'hold_expired', updated_at = ? WHERE id = ? AND state NOT IN ('paid', 'payment_review')")
        .bind(now, taskId),
      this.db.prepare(`INSERT OR IGNORE INTO audit_events
        (id, task_id, actor, action, target, payload_json, result, created_at)
        SELECT ?, ?, 'system', 'hold.expired', ?, ?, 'recorded', ?
        WHERE NOT EXISTS (SELECT 1 FROM payment_settlements WHERE quote_id = ?)`)
        .bind(`expired:${hold.id}`, taskId, hold.id, JSON.stringify({quoteId: hold.quoteId}), now, hold.quoteId)
    ]);
  }

  async recordPaymentEvent(
    eventId: string,
    eventType: string,
    processedAt: string
  ): Promise<boolean> {
    const result = await this.db
      .prepare(
        `INSERT OR IGNORE INTO payment_events
          (gateway_event_id, event_type, processed_at) VALUES (?, ?, ?)`
      )
      .bind(eventId, eventType, processedAt)
      .run();
    return result.meta.changes === 1;
  }

  async appendAudit(event: AuditEvent): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO audit_events
          (id, task_id, actor, action, target, payload_json, result, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        event.id,
        event.taskId,
        event.actor,
        event.action,
        event.target,
        JSON.stringify(event.payload),
        event.result,
        event.createdAt
      )
      .run();
  }

  async listAudit(taskId: string): Promise<AuditEvent[]> {
    const rows = await this.db
      .prepare(
        `SELECT * FROM audit_events
         WHERE task_id = ? ORDER BY created_at, id`
      )
      .bind(taskId)
      .all<AuditRow>();

    return rows.results.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      actor: row.actor,
      action: row.action,
      target: row.target,
      payload: JSON.parse(row.payload_json) as Record<string, unknown>,
      result: row.result,
      createdAt: row.created_at
    }));
  }

  async listDepartureOverview(): Promise<DepartureOverview[]> {
    const rows = await this.db
      .prepare(
        `SELECT departures.id, treks.name AS trek_name, departures.start_at,
                departures.capacity, departures.available, departures.status
         FROM departures JOIN treks ON treks.id = departures.trek_id
         ORDER BY departures.start_at`
      )
      .all<{
        id: string;
        trek_name: string;
        start_at: string;
        capacity: number;
        available: number;
        status: Departure["status"];
      }>();
    return rows.results.map((row) => ({
      id: row.id,
      trekName: row.trek_name,
      startAt: row.start_at,
      capacity: row.capacity,
      available: row.available,
      status: row.status
    }));
  }

  async listRecentTasks(limit = 12): Promise<TaskRecord[]> {
    const rows = await this.db
      .prepare(
        `SELECT id, context_id, state, request_json, created_at, updated_at
         FROM a2a_tasks ORDER BY updated_at DESC LIMIT ?`
      )
      .bind(limit)
      .all<{
        id: string;
        context_id: string;
        state: string;
        request_json: string;
        created_at: string;
        updated_at: string;
      }>();
    return rows.results.map((row) => ({
      id: row.id,
      contextId: row.context_id,
      state: row.state,
      request: JSON.parse(row.request_json) as Record<string, unknown>,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async listActiveHolds(now = new Date().toISOString()): Promise<HoldRecord[]> {
    const rows = await this.db
      .prepare(
        `SELECT id, departure_id, quote_id, party_size, hold_token, expires_at, status
         FROM holds WHERE status = 'held' AND expires_at > ? ORDER BY expires_at`
      )
      .bind(now)
      .all<{
        id: string;
        departure_id: string;
        quote_id: string;
        party_size: number;
        hold_token: string;
        expires_at: string;
        status: HoldRecord["status"];
      }>();
    return rows.results.map((row) => ({
      id: row.id,
      departureId: row.departure_id,
      quoteId: row.quote_id,
      partySize: row.party_size,
      holdToken: row.hold_token,
      expiresAt: row.expires_at,
      status: row.status
    }));
  }

  async listRecentAudit(limit = 24): Promise<AuditEvent[]> {
    const rows = await this.db
      .prepare(
        `SELECT * FROM audit_events ORDER BY created_at DESC, id DESC LIMIT ?`
      )
      .bind(limit)
      .all<AuditRow>();
    return rows.results.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      actor: row.actor,
      action: row.action,
      target: row.target,
      payload: JSON.parse(row.payload_json) as Record<string, unknown>,
      result: row.result,
      createdAt: row.created_at
    }));
  }
}
