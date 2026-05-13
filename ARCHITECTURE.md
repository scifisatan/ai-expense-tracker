# Architecture Overview

## What this repo is
A **single Cloudflare Worker modular monolith** with 3 surfaces:

- **Telegram bot** at `/`
- **Web dashboard** at `/app`
- **tRPC API** at `/api`

Entry point: `src/index.ts`
- redirects `/` -> `/app`
- mounts bot, web, and api routes

## Macro structure

```txt
src/
  apps/      transport/UI adapters
  services/  business logic
  db/        schema + repositories
  shared/    Zod schemas + shared types
  utils/     logging, cookies, constants
```

## Layering model

### 1) `src/apps/*`
Adapters for each channel:
- `apps/bot` — Telegram webhook + grammY handlers
- `apps/api` — Hono + tRPC server
- `apps/web` — React dashboard

### 2) `src/services/*`
Use-case layer and orchestration:
- `ledger.ts` — add/update/delete transactions, recompute balance, publish Telegram balance
- `ai.ts` — Groq extraction from natural language text
- `auth/*` — OTP challenge + session token logic
- `telegram-balance.ts` — pinned balance read/write
- `ledger-totals.ts` — pure computation helpers

### 3) `src/db/*`
Persistence layer via **Drizzle ORM + Cloudflare D1**:
- `schema.ts` — `users`, `userSettings`, `transactions`
- `repositories/users.ts`
- `repositories/settings.ts`
- `repositories/ledger.ts`
- `client.ts` — Drizzle client factory

### 4) `src/shared/*`
Shared contracts and validation:
- Zod input schemas
- transaction/auth types
- AI extraction schema
- summary/projection types

### 5) `src/utils/*`
Cross-cutting helpers:
- `logger.ts`
- `cookies.ts`
- `constants.ts`

## App breakdown

## Telegram bot (`src/apps/bot`)
Files:
- `index.ts` — webhook entry
- `controller.ts` — bot-facing facade
- `handlers/commands.ts`
- `handlers/messages.ts`
- `handlers/callbacks.ts`
- `ui.ts`

Responsibilities:
- Handle commands (`/start`, `/setkey`, `/balance`, `/transactions`, etc.)
- Parse free-text transaction messages
- Store ledger entries
- Publish current balance back to Telegram

Flow:
1. Telegram update hits bot route
2. grammY bot is created per request
3. handlers call `BotController`
4. controller calls services + repos
5. balance is recomputed and pinned in Telegram

## Web dashboard (`src/apps/web`)
Files:
- `index.tsx` — SSR HTML shell
- `client.tsx` — React bootstrap
- `App.tsx` — auth gate
- `components/*`
- `hooks/*`

Responsibilities:
- OTP-based login
- Show transaction dashboard
- Search/filter/sort rows
- Inline edit/delete transactions
- Show summary metrics

Key UI pieces:
- `AuthScreen` — OTP login flow
- `Dashboard` — table + summary
- `EditableRow` — row editing

Hooks:
- `useAuth` — session state
- `useOtpChallenge` — request/verify OTP
- `useTransaction` — queries + mutations
- `useTransactionFilter` — filtering/sorting
- `useTransactionSelection` — bulk selection

## API / tRPC (`src/apps/api`)
Files:
- `index.ts` — Hono + tRPC bridge
- `trpc.ts` — context, middleware, auth guard
- `router.ts` — router assembly
- `routes/auth.ts`
- `routes/transactions.ts`
- `routes/insights.ts`

Responsibilities:
- Serve typed API for the web app
- Resolve session from cookie
- Inject services into tRPC context
- Protect routes using `chatId`

Routers:
- `auth.*` — session / OTP / logout
- `transactions.*` — list / update / delete
- `insights.summary` — ledger summary

## Data flow

### Telegram message ingestion
```txt
Telegram message
  -> bot handler
  -> BotController
  -> settings repo (Groq key)
  -> AI extraction
  -> ledger service
  -> transactions repo
  -> summary recompute
  -> Telegram balance publish
```

### Web login
```txt
Web app
  -> request OTP
  -> Telegram sends code
  -> verify OTP
  -> signed cookie set
  -> tRPC session becomes authenticated
```

### Dashboard data
```txt
React hooks
  -> tRPC client
  -> API routes
  -> services
  -> repositories
  -> D1
```

## Main runtime dependencies
- **Cloudflare Workers** runtime
- **D1** for persistence
- **grammY** for Telegram bot handling
- **Hono** for HTTP routing
- **tRPC** for typed web/API communication
- **Drizzle ORM** for DB access
- **Groq** via AI SDK for transaction extraction

## Architecture style
This is best described as:

**single-worker modular monolith with layered boundaries**

or:

**clean-architecture-lite**

- adapters in `apps/`
- use-cases in `services/`
- persistence in `db/`
- contracts in `shared/`

## Notable inconsistencies / TODOs
- README mentions `/webhook`, but bot route is mounted at `/`
- Web auth UI suggests username or chat ID, but auth service currently only resolves `chatId`
- Help text mentions `/clear`, but no `/clear` handler exists
