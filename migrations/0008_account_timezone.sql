-- Per-account timezone, used to resolve relative dates from the AI and to
-- compute month/week period boundaries for summaries and budgets.
ALTER TABLE accounts ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC';
