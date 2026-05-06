# Telegram Budget Bot (Cloudflare Workers)

Telegram budget tracker running on **Cloudflare Workers** using:
- **Hono** for webhook HTTP routing
- **grammY** for Telegram bot handling
- **D1** for per-user config (Groq API key) and per-chat transaction history
- **Groq** for transaction extraction

## Notes

- No Durable Objects
- No model picker
- Per-user Groq API key is required for message processing

The bot uses a single model from `AI_MODEL` (or default fallback).

## Required bindings / vars

Configure in `wrangler.jsonc` / `wrangler secret`:

- `BOT_TOKEN`
- `DB` (D1 binding)
- `AI_MODEL` (optional, has default)
- `WEBHOOK_URL` (optional; if set, bot auto-calls Telegram `setWebhook` to `${WEBHOOK_URL}/webhook` on first request)
- `WEBAPP_AUTH_SECRET` (recommended, used to sign OTP/session tokens for `/app` web login)

## D1 setup

1. Create DB:
```bash
wrangler d1 create telegram_budget_bot
```

2. Put returned `database_id` in `wrangler.jsonc`.

3. Apply migrations:
```bash
npm run db:migrate:local
# or for deployed DB
npm run db:migrate:remote
```

Schema is managed explicitly via SQL files in `migrations/`.

## Commands

- `/start` Initialize and pin balance, then prompts for Groq key
- `/setkey <groq_key>` Save/update your Groq API key
- `/removekey` Remove your saved key
- `/keystatus` Check if key is set
- `/balance` Show current balance
- `/transactions` Show recent transaction history
- `/help` Show help

## Local development

```bash
npm install
npm run web:build
npm run dev
```

Web app is served from `/app` and uses OTP login sent to Telegram.

## Deploy

```bash
npm run build
npm run deploy
```

## Telegram webhook

After deploy, set webhook URL to:

```text
https://<your-worker-domain>/webhook
```

Example:
```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://<your-worker-domain>/webhook"
```
