-- First-run onboarding: capture currency + timezone once, up front.
-- NULL onboarded_at means onboarding hasn't been completed yet. Existing accounts
-- are grandfathered as already onboarded so they aren't re-prompted; their currency
-- lock is governed by whether they already have transactions.
ALTER TABLE accounts ADD COLUMN onboarded_at TEXT;
UPDATE accounts SET onboarded_at = CURRENT_TIMESTAMP WHERE onboarded_at IS NULL;
