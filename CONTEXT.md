# Domain Context

## Concepts

- **Ledger**: the per-chat record of financial entries used to derive balance and summary values.
- **Transaction Entry**: one income or expense row with amount, type, note, timestamps, and chat/user linkage.
- **Balance Projection**: computed values (income, expense, net, current balance) derived from Ledger history.
- **Web Login Challenge**: OTP challenge used to authenticate a chat identity for dashboard access.

## Channels

- **Telegram Bot**: accepts natural-language entries and command interactions.
- **Web Dashboard**: lists, edits, and deletes entries; displays Balance Projection.
- **Worker Router**: HTTP/trpc entrypoint that coordinates channel adapters.

## Persistence

- **D1 Ledger Store**: storage for Transaction Entry rows.
- **D1 User Store**: storage for user identity and Groq key settings.
