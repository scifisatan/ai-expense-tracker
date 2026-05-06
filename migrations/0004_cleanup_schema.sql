-- Clean up old tables and set up new schema
DROP TABLE IF EXISTS user_config;

-- Clear old transactions that don't have user_id if any exist (or just update them)
-- For a fresh start as requested, we can also wipe old data
DELETE FROM transactions;

-- Ensure transaction table has user_id and it's indexed
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_chat_id ON transactions(chat_id);
