-- Workers AI replaces the per-user Groq key: the platform now supplies the
-- model, so the stored key is obsolete. Drop the column from account_settings.
ALTER TABLE account_settings DROP COLUMN groq_api_key;
