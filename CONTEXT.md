# Project Context

A budget-tracking app where a **web account is the root identity** and **Telegram is a
linked input channel** for adding transactions in natural language. It runs as a single
Cloudflare Worker serving three surfaces from one codebase.

This document is the full picture — what it is, how it's wired, the data model, the key
flows, and the gotchas. For setup/commands see `README.md`.

---

## 1. What it does

- Users **sign in on the web with Google** (OAuth). That creates an account.
- The web dashboard is **fully featured**: manual transaction entry, natural-language
  entry, categories, multi-currency, editing/deleting, and summary insights.
- Users can **connect Telegram** to an account. Once linked, messages sent to the bot like
  `spent 12.50 on coffee` are parsed and recorded against that account, and the bot keeps a
  pinned balance message up to date.
- Natural-language parsing uses **Groq**, with a **per-account API key** (set in web
  Settings or via the bot's `/setkey`).

---

## 2. Runtime shape

One **Cloudflare Worker** (entry `src/index.ts`) routes three surfaces via Hono:

| Path    | Surface           | Notes                                            |
| ------- | ----------------- | ------------------------------------------------ |
| `/`     | Telegram webhook  | `POST` updates handled by grammY                 |
| `/app`  | Web dashboard     | React SPA (Vite)                                 |
| `/api`  | tRPC API + OAuth  | `/api/auth/google*` for OAuth, rest is tRPC      |

`GET /` redirects to `/app`.

---

## 3. Architectural principle: tRPC-centric monolith

All domain/business logic lives in **tRPC procedures** (`src/apps/api/routes/*`). Both
surfaces call the same procedures, so behavior never forks between web and bot:

- **Web** → HTTP to `/api`; `accountId` is resolved from the session cookie.
- **Bot** → an in-process caller (`createBotCaller`, no HTTP); `accountId` is resolved from
  `telegram_links` for the incoming chat.

Bot handlers are **transport adapters only** — they translate Telegram events into tRPC
calls and format replies. They contain no DB access or business logic.

```txt
src/
  apps/
    api/
      index.ts          HTTP bridge: builds tRPC context, mounts OAuth routes
      router.ts         assembles sub-routers
      trpc.ts           context type + protectedProcedure guard
      caller.ts         in-process bot caller (resolves account, no HTTP)
      routes/           auth, oauth, telegram, settings, categories, ledger,
                        transactions, insights
      repositories/     Drizzle data access (accounts, transactions, categories,
                        settings, telegram)
      lib/              token-session (HMAC sign/verify), ledger (balance publish)
    bot/                grammY handlers (commands, messages, callbacks) + ui
    web/                React dashboard (components, hooks, trpc client)
  db/                   Drizzle schema + D1 client factory
  shared/               Zod contracts (types.ts), money helpers (money.ts)
  services/             ai.ts (Groq extraction)
  utils/                logger, cookies, constants
```

---

## 4. Data model (`src/db/schema.ts`)

Everything hangs off `accounts`. Money is stored as **integer minor units**
(`amount_minor`, e.g. cents) plus an ISO currency code — never floats.

| Table             | Purpose                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `accounts`        | Root identity. `id` (uuid), `email`, `oauth_provider`+`oauth_subject` (unique), `default_currency`. |
| `telegram_links`  | Maps a Telegram `chat_id` → `account_id` (+ cached Telegram profile).   |
| `link_codes`      | One-time codes the bot issues and the web confirms, to create a link.   |
| `categories`      | Per-account, typed `Income`/`Expense`. Defaults seeded on signup.       |
| `transactions`    | Per-account: `amount_minor`, `currency`, `type`, `category_id`, `note`, `occurred_at`, `source` (`web`/`telegram`). |
| `account_settings`| Per-account `groq_api_key`.                                             |

The DB client (`createDb`) wraps D1 with the Drizzle schema and is created per-request and
injected into the tRPC context.

---

## 5. Identity & auth

### Web sign-in (Google OAuth) — `src/apps/api/routes/oauth.ts`
1. `GET /api/auth/google` → redirects to Google with a signed `state` (CSRF) stored in a
   short cookie. Redirect URI is `${APP_URL}/api/auth/google/callback`.
2. `GET /api/auth/google/callback` → verifies `state` against the cookie, exchanges the code
   at Google's token endpoint, decodes the `id_token` for `sub`/`email`/`name`, upserts the
   account (seeding default categories on first login), sets the session cookie, redirects
   to `/app`.

### Sessions — `src/apps/api/lib/token-session.ts`
Stateless HMAC-signed tokens (`{ accountId, exp }`) signed with **`SESSION_SECRET`** (a
dedicated secret — *not* the bot token). The same module signs/verifies the OAuth `state`.
`src/apps/api/index.ts` reads the session cookie and puts `accountId` on the context.

### Telegram linking — `src/apps/api/routes/telegram.ts`
The bot already knows the Telegram identity, so linking is **bot-initiated, web-confirmed**:
1. User sends `/link` → `telegram.requestLinkCode` (bot-only) writes a `link_codes` row and
   the bot replies with a short, high-entropy, single-use code (5-min TTL).
2. Signed-in user enters the code in **Settings → Connect Telegram** → `telegram.confirmLink`
   creates the `telegram_links` row and deletes the code.

Unlinked chats are guided to connect instead of silently tracked.

---

## 6. Key flows

### Natural-language ingestion (shared by web NL box and the bot)
```txt
text → ledger.ingestText (protected, account-scoped)
     → read account Groq key (returns reason:"NO_KEY" if missing)
     → Groq extraction → items: { amount(decimal), type, note, category? }
     → convert amounts to minor units; resolve category hints to category_id
     → insert transactions (source = "telegram" for bot, "web" for web)
     → recompute net balance
     → publish/pin balance to every linked Telegram chat
```

### Manual entry (web)
`transactions.create` takes a decimal amount + type + optional category/note/date, converts
to minor units using the account's default currency, inserts, and republishes the balance.

### Balance publishing — `src/apps/api/lib/ledger.ts`
`publishBalance` looks up all `telegram_links` for the account and sends + pins a formatted
balance message to each chat. No-op if the account has no linked chat or no bot token.

---

## 7. tRPC procedures (the API surface)

- `auth.session` / `auth.logout` — session status; logout (cookie cleared client-side).
- `telegram.requestLinkCode` (bot) / `confirmLink` / `listLinks` / `unlink` (web).
- `settings.get` / `setGroqKey` / `removeGroqKey` / `setDefaultCurrency`.
- `categories.list` / `create` / `update` / `delete`.
- `ledger.ingestText` (web + bot) / `refreshBalance`.
- `transactions.create` / `list` / `update` / `delete`.
- `insights.summary` — income/expense/net/count + currency.

All except `auth.session` and `telegram.requestLinkCode` use `protectedProcedure`
(require an `accountId`).

---

## 8. Web app (`src/apps/web`)

- `App.tsx` → `AuthScreen` (Google button) when unauthenticated, else `Dashboard`.
- `Dashboard.tsx` — summary cards/insights, `QuickEntry` (manual + NL tabs), the
  transactions table (sort/filter/search/bulk-delete), and the `SettingsPanel` modal.
- `SettingsPanel.tsx` — Groq key, default currency, Telegram connect/disconnect, and
  category management.
- `EditableRow.tsx` — inline edit with currency-aware money + category select.
- Hooks: `useAuth`, `useTransaction` (queries + create/ingest/update/delete + categories),
  `useTransactionFilter`, `useTransactionSelection`.
- Money is formatted via `src/shared/money.ts` (`formatMoney`, `fromMinor`).

---

## 9. Money (`src/shared/money.ts`)

- Stored as integer minor units; the API/UI work in major-unit decimals.
- `toMinor` / `fromMinor` respect zero-decimal currencies (JPY, KRW, …).
- `formatMoney` uses `Intl.NumberFormat`, with a graceful fallback for unknown codes.
- Unit-tested in `src/shared/money.test.ts`.

---

## 10. Environment / configuration

Secrets (via `wrangler secret put` in prod, `.env` locally): `BOT_TOKEN`, `SESSION_SECRET`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Vars (`wrangler.jsonc`): `APP_URL`, `AI_MODEL`,
optional `WEBHOOK_URL`. Bindings: `DB` (D1), `BOT_INFO` (KV).

> The Google OAuth client must authorize the exact redirect URI
> `${APP_URL}/api/auth/google/callback` (local and prod).

---

## 11. Local development & validation

- `npm run dev` — Vite + Cloudflare plugin on `http://localhost:3001` (runs the worker).
- For the bot locally, tunnel `:3001` (e.g. ngrok) and point the Telegram webhook at it.
- `npm run db:migrate:local` / `:remote` — apply migrations (`0005_account_identity.sql`
  creates the account-first schema; it wipes the old Telegram-keyed tables).
- Checks: `npm run build`, `npm run lint`, `npm run test`, `pnpm exec tsc --noEmit`.

---

## 12. Known limitations / follow-ups

- **No rate limiting** on `telegram.confirmLink` / OAuth callback. Current protection: link
  codes are single-use, short-TTL, high-entropy. Robust limiting needs KV/Durable Objects.
- Deleting a category does **not** reassign transactions that referenced it (they show no
  category).
- New accounts default to **USD** (changeable per-account in Settings).
- No recurring transactions / budgets yet.
