CREATE TABLE payment_settlements (
  quote_id TEXT PRIMARY KEY REFERENCES quotes(id),
  hold_id TEXT NOT NULL REFERENCES holds(id),
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'review')),
  created_at TEXT NOT NULL
);
