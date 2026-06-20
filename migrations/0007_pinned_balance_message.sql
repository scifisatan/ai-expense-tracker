-- Pin the balance message in place instead of posting a new one each time:
-- track the Telegram message id of the currently pinned balance per chat.
ALTER TABLE telegram_links ADD COLUMN pinned_message_id INTEGER;
