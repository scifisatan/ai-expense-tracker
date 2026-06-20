-- Session revocation: bumping token_version invalidates all outstanding
-- session tokens for the account ("log out everywhere").
ALTER TABLE accounts ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
