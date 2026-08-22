ALTER TABLE approvals RENAME TO approvals_before_hold_gate;

CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id),
  quote_version INTEGER NOT NULL,
  gate TEXT NOT NULL CHECK (gate IN ('itinerary', 'hold', 'payment')),
  actor_session_id TEXT NOT NULL,
  digest TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  UNIQUE(quote_id, gate)
);

INSERT INTO approvals
  (id, quote_id, quote_version, gate, actor_session_id, digest, approved_at)
SELECT id, quote_id, quote_version, gate, actor_session_id, digest, approved_at
FROM approvals_before_hold_gate;

DROP TABLE approvals_before_hold_gate;
