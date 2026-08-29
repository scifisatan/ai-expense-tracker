-- Pacer: daily-allowance pacing cycles, sweep ledger, and needs/wants queue.

-- One income period being paced. [start_at, end_at) is a half-open range,
-- the same convention as monthRange/weekRange. Transaction membership in a
-- cycle is derived from occurred_at falling in this range, not stored.
CREATE TABLE cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  gross_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  sweep_pct INTEGER NOT NULL DEFAULT 50,
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cycles_account_id ON cycles(account_id);
CREATE INDEX idx_cycles_account_range ON cycles(account_id, start_at, end_at);

-- Off-the-top deductions from a cycle's gross before the pacing pool is
-- computed. kind = 'needs_reserve' also credits the needs_reserve fund
-- bucket on the cycle's first day close; every other kind is a plain
-- deduction (label carries the specific "Netflix", "Rent", etc.).
CREATE TABLE allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id INTEGER NOT NULL REFERENCES cycles(id),
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_allocations_cycle_id ON allocations(cycle_id);

-- One row per account per local calendar day, written once by the day-close
-- cron. Composite PK makes retries idempotent no-ops; row is immutable once written.
CREATE TABLE day_closes (
  account_id TEXT NOT NULL REFERENCES accounts(id),
  local_date TEXT NOT NULL,
  cycle_id INTEGER NOT NULL REFERENCES cycles(id),
  allowance_minor INTEGER NOT NULL,
  spent_minor INTEGER NOT NULL,
  swept_minor INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, local_date)
);

CREATE INDEX idx_day_closes_cycle_id ON day_closes(cycle_id);

-- Needs/wants queue. rank is a fractional drag-reorder sort key.
CREATE TABLE queue_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  price_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  rank REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  cooling_until TEXT,
  deadline TEXT,
  purchased_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_queue_items_account_id ON queue_items(account_id);
CREATE INDEX idx_queue_items_account_kind_status_rank ON queue_items(account_id, kind, status, rank);

-- Append-only ledger for both funds. Balance = SUM(delta_minor) per
-- (account_id, bucket) -- never a stored running total, so a partial failure
-- can never leave a balance that disagrees with the underlying history.
CREATE TABLE fund_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  bucket TEXT NOT NULL,
  delta_minor INTEGER NOT NULL,
  reason TEXT NOT NULL,
  day_close_local_date TEXT,
  queue_item_id INTEGER REFERENCES queue_items(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fund_ledger_account_id ON fund_ledger(account_id);
CREATE INDEX idx_fund_ledger_account_bucket ON fund_ledger(account_id, bucket);

-- Idempotency guard for the once-daily 8am local-time push, independent of
-- day_closes since the two crons fire at different local hours.
CREATE TABLE morning_pushes (
  account_id TEXT NOT NULL REFERENCES accounts(id),
  local_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, local_date)
);
