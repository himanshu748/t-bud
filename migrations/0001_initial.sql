PRAGMA foreign_keys = ON;

CREATE TABLE treks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  duration_nights INTEGER NOT NULL CHECK (duration_nights >= 0),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'moderate', 'hard')),
  unit_amount INTEGER NOT NULL CHECK (unit_amount >= 0),
  description TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE departures (
  id TEXT PRIMARY KEY,
  trek_id TEXT NOT NULL REFERENCES treks(id),
  start_at TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  available INTEGER NOT NULL CHECK (available >= 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'sold_out', 'cancelled'))
);

CREATE INDEX idx_departures_trek_start ON departures(trek_id, start_at);

CREATE TABLE addons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('pickup', 'meals')),
  scope TEXT NOT NULL CHECK (scope IN ('per_booking', 'per_person')),
  unit_amount INTEGER NOT NULL CHECK (unit_amount >= 0),
  eligibility_json TEXT NOT NULL DEFAULT '{}',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE a2a_tasks (
  id TEXT PRIMARY KEY,
  context_id TEXT NOT NULL,
  state TEXT NOT NULL,
  request_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE quotes (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES a2a_tasks(id),
  version INTEGER NOT NULL CHECK (version > 0),
  trek_id TEXT NOT NULL REFERENCES treks(id),
  departure_id TEXT NOT NULL REFERENCES departures(id),
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  budget INTEGER NOT NULL CHECK (budget >= 0),
  currency TEXT NOT NULL CHECK (currency = 'INR'),
  total INTEGER NOT NULL CHECK (total >= 0),
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ready', 'approved', 'expired', 'superseded')),
  UNIQUE(task_id, version)
);

CREATE INDEX idx_quotes_task_version ON quotes(task_id, version);

CREATE TABLE quote_items (
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('trek', 'addon')),
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_amount INTEGER NOT NULL CHECK (unit_amount >= 0),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  reason TEXT,
  source TEXT,
  PRIMARY KEY (quote_id, position)
);

CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id),
  quote_version INTEGER NOT NULL,
  gate TEXT NOT NULL CHECK (gate IN ('itinerary', 'payment')),
  actor_session_id TEXT NOT NULL,
  digest TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  UNIQUE(quote_id, gate)
);

CREATE TABLE holds (
  id TEXT PRIMARY KEY,
  departure_id TEXT NOT NULL REFERENCES departures(id),
  quote_id TEXT NOT NULL REFERENCES quotes(id),
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  hold_token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('held', 'released', 'expired'))
);

CREATE INDEX idx_holds_departure_status ON holds(departure_id, status);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id) UNIQUE,
  razorpay_order_id TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  payment_id TEXT,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('created', 'verified', 'failed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE payment_events (
  gateway_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES a2a_tasks(id),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_audit_task_created ON audit_events(task_id, created_at);
