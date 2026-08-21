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
         WHERE id = ?`
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
        `SELECT quote_id, quote_version, gate, actor_session_id, digest, approved_at
         FROM approvals WHERE quote_id = ? AND gate = ?`
      )
      .bind(quoteId, gate)
      .first<{
        quote_id: string;
        quote_version: number;
        gate: ApprovalGate;
        actor_session_id: string;
        digest: string;
        approved_at: string;
      }>();
    if (!row) return null;
    return {
      quoteId: row.quote_id,
      quoteVersion: row.quote_version,
      gate: row.gate,
      actorSessionId: row.actor_session_id,
      digest: row.digest,
      approvedAt: row.approved_at
    };
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
}
