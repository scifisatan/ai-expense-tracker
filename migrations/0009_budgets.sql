-- Spending budgets and per-period alert bookkeeping.
-- A null category_id is an overall account budget.
CREATE TABLE budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  category_id INTEGER REFERENCES categories(id),
  period TEXT NOT NULL DEFAULT 'monthly',
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_budgets_account_id ON budgets(account_id);

-- Records which threshold (80 / 100) has alerted for a budget in a given period
-- key (e.g. "2026-06") so each alert fires at most once.
CREATE TABLE budget_alerts (
  budget_id INTEGER NOT NULL REFERENCES budgets(id),
  period_key TEXT NOT NULL,
  threshold INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_budget_alerts_unique
  ON budget_alerts(budget_id, period_key, threshold);
