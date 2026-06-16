-- Account-first redesign: the web account (Google OAuth) is the root identity and
-- Telegram becomes a linked input channel. Existing Telegram-keyed data is wiped.

DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS user_settings;
DROP TABLE IF EXISTS users;

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  oauth_provider TEXT NOT NULL,
  oauth_subject TEXT NOT NULL,
  default_currency TEXT NOT NULL DEFAULT 'USD',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_accounts_email ON accounts(email);
CREATE UNIQUE INDEX idx_accounts_oauth ON accounts(oauth_provider, oauth_subject);

CREATE TABLE telegram_links (
  chat_id INTEGER PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  telegram_user_id INTEGER,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  linked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_telegram_links_account_id ON telegram_links(account_id);

CREATE TABLE link_codes (
  code TEXT PRIMARY KEY,
  chat_id INTEGER NOT NULL,
  telegram_user_id INTEGER,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  expires_at INTEGER NOT NULL
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  color TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_categories_account_id ON categories(account_id);

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  type TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  note TEXT,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source TEXT NOT NULL DEFAULT 'web',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_account_occurred ON transactions(account_id, occurred_at);

CREATE TABLE account_settings (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id),
  groq_api_key TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
