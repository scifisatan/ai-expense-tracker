# Budget App (Cloudflare Workers)

Account-first budget tracker running on **Cloudflare Workers**:

- **Web account is the root identity** — sign in with **Google**.
- **Telegram is a linked input channel** — connect it to add transactions in natural language.
- Full-featured web: **manual entry** and **natural-language entry**, categories, multi-currency.

Stack:

- **Hono** for HTTP routing
- **grammY** for the Telegram bot
- **tRPC** as the single business-logic surface (shared by web + bot)
- **Drizzle ORM + D1** for persistence
- **Groq** (per-account key) for natural-language extraction

> For the full architecture, data model, flows, and design notes, see **[CONTEXT.md](./CONTEXT.md)**.

## Routes

- `/` Telegram webhook endpoint (POST)
- `/app` Web dashboard
- `/api` tRPC API
- `/api/auth/google` Google OAuth login + callback

## Identity model

1. User signs in on the web with Google → an `accounts` row is created (with default categories).
2. To use Telegram, the user sends `/link` to the bot → the bot returns a one-time code.
3. The user enters that code in the dashboard (**Settings → Connect Telegram**) → a
   `telegram_links` row maps the chat to the account.
4. Afterwards, messages sent to the bot are recorded against that account; unlinked chats
   get a "connect your account" prompt.

## Required bindings / vars

Configure in `wrangler.jsonc` and via `wrangler secret put`:

- `BOT_TOKEN` (secret)
- `BOT_INFO` (KV namespace entry with serialized bot info)
- `DB` (D1 binding)
- `SESSION_SECRET` (secret) — signs session + OAuth state cookies
- `GOOGLE_CLIENT_ID` (secret)
- `GOOGLE_CLIENT_SECRET` (secret)
- `APP_URL` (var) — base URL, used to build the OAuth redirect URI
- `AI_MODEL` (var, optional; default provided)
- `WEBHOOK_URL` (var, optional)

### Google OAuth setup

1. Create an OAuth 2.0 Client (type: Web application) in the Google Cloud Console.
2. Authorized redirect URI: `${APP_URL}/api/auth/google/callback`
   (e.g. `http://localhost:3001/api/auth/google/callback` for local dev).
3. Put the client id/secret into `.dev.vars` (local) or `wrangler secret put` (deployed).

## D1 setup

```bash
wrangler d1 create telegram_budget_bot   # put the returned id in wrangler.jsonc
npm run db:migrate:local                 # or db:migrate:remote for deployed DB
```

> Migration `0005_account_identity.sql` wipes the old Telegram-keyed tables and creates
> the account-first schema.

## Bot commands

- `/start` Show status / connect prompt
- `/link` Get a code to connect this chat to your account
- `/app` Open the web dashboard
- `/setkey <key>` Save your Groq API key
- `/removekey` Remove your saved Groq API key
- `/keystatus` Check key status
- `/balance` Republish current balance
- `/transactions` Show recent transactions
- `/help` Show help

## Local development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run build
npm run lint
npm run test
pnpm exec tsc --noEmit
```

## Deploy

```bash
npm run build
npm run deploy
```

Then set the Telegram webhook:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://<your-worker-domain>/"
```
