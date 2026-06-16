# Budget App (Cloudflare Workers)

Account-first budget tracker running on **Cloudflare Workers**:

- **Web account is the root identity** — sign in with **Google**.
- **Telegram is a linked input channel** — connect it to add transactions in natural language.
- Full-featured web: **manual entry** and **natural-language entry**, categories, multi-currency, dark mode.

Stack:

- **Hono** for HTTP routing
- **grammY** for the Telegram bot
- **tRPC** as the single business-logic surface (shared by web + bot)
- **Drizzle ORM + D1** for persistence
- **Vercel AI SDK + Groq** for natural-language extraction, optionally routed through a
  **Cloudflare AI Gateway** (single app-level key, with per-account daily limits)
- **React 19 + Vite + Tailwind v4 + Radix UI** for the dashboard

> For step-by-step configuration and deployment, see **[DEPLOY.md](./DEPLOY.md)**.
> For the full architecture, data model, flows, and design notes, see **[CONTEXT.md](./CONTEXT.md)**.

## Routes

- `/` Telegram webhook endpoint (POST); `GET /` redirects to `/app`
- `/app` Web dashboard
- `/api` tRPC API
- `/api/auth/google` Google OAuth login + callback

## Identity model

1. User signs in on the web with Google → an `accounts` row is created (with default categories).
2. To use Telegram, the user sends `/link` to the bot → the bot returns a one-time code.
3. The user enters that code in the dashboard (**Settings → Telegram**) → a
   `telegram_links` row maps the chat to the account.
4. Afterwards, messages sent to the bot are recorded against that account; unlinked chats
   get a "connect your account" prompt.

## Required bindings / vars

> For a full walkthrough — provisioning resources, obtaining each credential, and deploying —
> see **[DEPLOY.md](./DEPLOY.md)**. The summary below is for quick reference.

Configure in `wrangler.jsonc` and via `wrangler secret put` (or `.dev.vars` locally):

**Secrets:**

- `BOT_TOKEN` — Telegram bot token
- `SESSION_SECRET` — signs session + OAuth state cookies
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GROQ_API_KEY` — single app-level key for AI extraction

**Vars (`wrangler.jsonc`):**

- `APP_URL` — base URL, used to build the OAuth redirect URI
- `AI_MODEL` — Groq model id (default: `meta-llama/llama-4-scout-17b-16e-instruct`)
- `AI_GATEWAY` — Cloudflare AI Gateway name; empty string calls Groq directly
- `AI_DAILY_LIMIT` — per-account daily extraction cap (default: `50`)
- `WEBHOOK_URL` (optional)

**Bindings:**

- `DB` — D1 database
- `AI` — Workers AI binding (used to route through the AI Gateway)
- `BOT_INFO` — KV namespace (serialized bot info + per-account AI rate-limit counters)

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

> Migrations live in `migrations/` (`0001`–`0006`). `0005_account_identity.sql` wipes the
> old Telegram-keyed tables and creates the account-first schema; `0006_drop_groq_api_key.sql`
> drops the obsolete per-account Groq key column.

## Bot commands

- `/start` Show status / connect prompt (republishes the pinned balance once linked)
- `/link` Get a code to connect this chat to your account
- `/app` Open the web dashboard
- `/balance` Republish current balance
- `/transactions` Show recent transactions
- `/help` Show help

> AI extraction now uses a single app-level Groq key, so the old `/setkey`, `/removekey`,
> and `/keystatus` commands no longer exist. Plain-language messages (e.g. `spent 12.50 on
> coffee`) are parsed automatically once a chat is linked.

## Local development

```bash
pnpm install   # repo uses pnpm; npm also works
npm run dev    # Vite + Cloudflare plugin on http://localhost:3001
```

For the bot locally, tunnel `:3001` (e.g. ngrok) and point the Telegram webhook at it.

## Validation

```bash
npm run build              # vite build
npm run lint               # oxlint
npm run test               # vitest run
npm run format             # oxfmt . --write
```

## Deploy

> Full instructions (Cloudflare resources, OAuth, secrets, webhook) are in **[DEPLOY.md](./DEPLOY.md)**.

```bash
npm run build
npm run deploy             # builds, then deploys
```

Then set the Telegram webhook:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://<your-worker-domain>/"
```
