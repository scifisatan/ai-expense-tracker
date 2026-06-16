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
  entry, categories, multi-currency, inline editing/deleting, summary insights, and dark mode.
- Users can **connect Telegram** to an account. Once linked, messages sent to the bot like
  `spent 12.50 on coffee` are parsed and recorded against that account, and the bot keeps a
  pinned balance message up to date.
- Natural-language parsing uses **Groq via the Vercel AI SDK**, with a **single app-level
  API key**. Calls can optionally be routed through a **Cloudflare AI Gateway** for
  observability/limits, and each account has a **per-day extraction cap** for fairness.

---

## 2. Runtime shape

One **Cloudflare Worker** (entry `src/index.ts`) routes three surfaces via Hono:

| Path    | Surface           | Notes                                            |
| ------- | ----------------- | ------------------------------------------------ |
| `/`     | Telegram webhook  | `POST` updates handled by grammY                 |
| `/app`  | Web dashboard     | React 19 SPA (Vite)                              |
| `/api`  | tRPC API + OAuth  | `/api/auth/google*` for OAuth, rest is tRPC      |

`GET /` redirects to `/app`.

---

## 3. Architectural principle: tRPC-centric monolith

All domain/business logic lives in **tRPC procedures** (`src/apps/api/routes/*`). Both
surfaces call the same procedures, so behavior never forks between web and bot:

- **Web** → HTTP to `/api`; `accountId` is resolved from the session cookie (`actor: "web"`).
- **Bot** → an in-process caller (`createBotCaller`, no HTTP); `accountId` is resolved from
  `telegram_links` for the incoming chat (`actor: "bot"`).

Bot handlers are **transport adapters only** — they translate Telegram events into tRPC
calls and format replies. They contain no DB access or business logic.

```txt
src/
  apps/
    env.ts            CloudflareBindings type (DB, AI, KV, secrets, vars)
    api/
      index.ts        HTTP bridge: builds tRPC context, mounts OAuth routes
      router.ts       assembles sub-routers
      trpc.ts         context type + public/protected procedures (requireAccount guard)
      caller.ts       in-process bot caller (resolves account, no HTTP)
      routes/         auth, oauth, telegram, settings, categories, ledger,
                      transactions, insights
      repositories/   Drizzle data access (accounts, categories, transactions, telegram)
      lib/            token-session (HMAC sign/verify), ledger (balance publish),
                      rate-limit (per-account daily AI quota, KV-backed)
    bot/              grammY handlers (commands, messages, callbacks) + ui copy
    web/              React dashboard (components, hooks, trpc client)
  db/                 Drizzle schema + D1 client factory
  shared/             Zod contracts (types.ts), money helpers (money.ts)
  services/           ai.ts (Groq extraction via Vercel AI SDK + optional AI Gateway)
  utils/              logger, cookies, constants
migrations/           D1 SQL migrations (0001–0006)
```

---

## 4. Data model (`src/db/schema.ts`)

Everything hangs off `accounts`. Money is stored as **integer minor units**
(`amount_minor`, e.g. cents) plus an ISO currency code — never floats.

| Table             | Purpose                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `accounts`        | Root identity. `id` (uuid), `email`, `name`, `oauth_provider`+`oauth_subject` (unique), `default_currency`. |
| `telegram_links`  | Maps a Telegram `chat_id` → `account_id` (+ cached Telegram profile).   |
| `link_codes`      | One-time codes the bot issues and the web confirms, to create a link.   |
| `categories`      | Per-account, typed `Income`/`Expense` (+ optional color). Defaults seeded on signup. |
| `transactions`    | Per-account: `amount_minor`, `currency`, `type`, `category_id`, `note`, `occurred_at`, `source` (`web`/`telegram`). |
| `account_settings`| Per-account row, currently just `account_id` + `updated_at` (the Groq key column was dropped in `0006`). |

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
`src/apps/api/index.ts` reads the session cookie and puts `accountId` (and `actor: "web"`)
on the context. Cookie names live in `src/utils/constants.ts`.

### Telegram linking — `src/apps/api/routes/telegram.ts`
The bot already knows the Telegram identity, so linking is **bot-initiated, web-confirmed**:
1. User sends `/link` → `telegram.requestLinkCode` writes a `link_codes` row and the bot
   replies with a short, high-entropy, single-use code (5-min TTL). The procedure is
   `publicProcedure` but rejects anything where `actor !== "bot"`.
2. Signed-in user enters the code in **Settings → Telegram** → `telegram.confirmLink`
   creates the `telegram_links` row and deletes the code.

Unlinked chats are guided to connect instead of silently tracked.

---

## 6. Key flows

### Natural-language ingestion (shared by web NL box and the bot)
```txt
text → ledger.ingestText (protected, account-scoped)
     → consume per-account daily AI quota (KV); over limit → reason:"RATE_LIMITED"
     → Groq extraction via Vercel AI SDK (generateObject, Zod schema)
        · routed through Cloudflare AI Gateway when AI_GATEWAY is set, else direct
     → items: { amount(decimal), type, note, category? }; empty → reason:"NO_ITEMS"
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

## 7. AI extraction & rate limiting

- **`src/services/ai.ts`** — `createAiService` builds a Groq model via `@ai-sdk/groq` and
  `generateObject` (validated against `transactionsSchema`). When `AI_GATEWAY` is set, the
  model is wrapped with `ai-gateway-provider` using the Workers `AI` binding; otherwise Groq
  is called directly. A single app-level `GROQ_API_KEY` is used for all accounts.
- **`src/apps/api/lib/rate-limit.ts`** — `consumeAiQuota` enforces a per-account daily cap
  (`AI_DAILY_LIMIT`, default 50). Counters are stored in the `BOT_INFO` KV namespace, keyed
  `ai-ratelimit:<accountId>:<YYYY-MM-DD>` with a ~1-day TTL. Best-effort (KV is eventually
  consistent), which is fine for a soft cap. A limit of `0` disables the cap.

---

## 8. tRPC procedures (the API surface)

- `auth.session` (public) / `auth.logout` — session status; logout.
- `telegram.requestLinkCode` (bot-gated public) / `confirmLink` / `listLinks` / `unlink`.
- `settings.get` / `setDefaultCurrency`.
- `categories.list` / `create` / `update` / `delete`.
- `ledger.ingestText` (web + bot) / `refreshBalance`.
- `transactions.create` / `list` / `update` / `delete`.
- `insights.summary` — income/expense/net/count + currency.

Everything except `auth.session` and `telegram.requestLinkCode` uses `protectedProcedure`
(`requireAccount` middleware → requires an `accountId`).

---

## 9. Web app (`src/apps/web`)

A redesigned, mobile-first dashboard built on React 19, Tailwind v4, and Radix UI primitives
(`components/ui/*`), with `sonner` toasts and `lucide-react` icons.

- `App.tsx` → `AuthScreen` (landing page + Google button) when unauthenticated, else `Dashboard`.
- `Dashboard.tsx` — header (theme toggle + account menu), then:
  - `BalanceHero.tsx` — net balance, today's delta, income/expense totals.
  - `CommandBar.tsx` — quick entry (manual + natural-language).
  - `ActivityFeed.tsx` / `ActivityItem.tsx` — transaction list with inline edit/delete.
  - `SettingsPanel.tsx` — tabbed modal: **General** (default currency), **Telegram**
    (connect/disconnect via link code), **Categories** (manage per-account categories).
- `TransactionDialog.tsx` — create/edit transaction dialog.
- `ThemeToggle.tsx` + `hooks/useTheme.ts` — light/dark theme.
- Hooks: `useAuth`, `useTransaction` (queries + create/ingest/update/delete + categories),
  `useTransactionFilter`, `useTransactionSelection`.
- Money is formatted via `src/shared/money.ts` (`formatMoney`, `fromMinor`).
- See `src/apps/web/DESIGN.md` for the visual/design system notes.

---

## 10. Money (`src/shared/money.ts`)

- Stored as integer minor units; the API/UI work in major-unit decimals.
- `toMinor` / `fromMinor` respect zero-decimal currencies (JPY, KRW, …).
- `formatMoney` uses `Intl.NumberFormat`, with a graceful fallback for unknown codes.
- Unit-tested in `src/shared/money.test.ts`.

---

## 11. Environment / configuration

Secrets (via `wrangler secret put` in prod, `.dev.vars` locally): `BOT_TOKEN`,
`SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GROQ_API_KEY`. Vars
(`wrangler.jsonc`): `APP_URL`, `AI_MODEL`, `AI_GATEWAY`, `AI_DAILY_LIMIT`, optional
`WEBHOOK_URL`. Bindings: `DB` (D1), `AI` (Workers AI), `BOT_INFO` (KV). The worker is served
on a custom domain (`routes` in `wrangler.jsonc`).

> The Google OAuth client must authorize the exact redirect URI
> `${APP_URL}/api/auth/google/callback` (local and prod).

---

## 12. Local development & validation

- `npm run dev` — Vite + Cloudflare plugin on `http://localhost:3001` (runs the worker).
- For the bot locally, tunnel `:3001` (e.g. ngrok) and point the Telegram webhook at it.
- `npm run db:migrate:local` / `:remote` — apply migrations from `migrations/`.
- Checks: `npm run build` (vite), `npm run lint` (oxlint), `npm run test` (vitest),
  `npm run format` (oxfmt). Repo uses **pnpm** as the package manager.

---

## 13. Known limitations / follow-ups

- **AI rate limiting** is per-account daily and KV-backed (best-effort). There is still no
  rate limiting on `telegram.confirmLink` / the OAuth callback; current protection there is
  single-use, short-TTL, high-entropy link codes. Robust limiting needs KV/Durable Objects.
- Deleting a category does **not** reassign transactions that referenced it (they show no
  category).
- New accounts default to **USD** (changeable per-account in Settings).
- No recurring transactions / budgets yet.
