# Architecture Overview

This codebase follows a practical layered architecture with explicit ports and a centralized bootstrap.

## Layer meanings

- **`domain/`**: pure business rules and use-cases for auth + ledger.
- **`application/`**: workflow orchestration and runtime application services (AI extraction, session/token handling, Telegram display adapter glue).
- **`ports/`**: interfaces that define external dependencies (repos, messaging, sessions, display).
- **`adapters/`**: concrete implementations for D1, Telegram, and tRPC transport.
- **`bootstrap/`**: composition root that wires modules and adapters.
- **`shared/contracts/`**: shared transport contracts (zod schemas) for API inputs.

---

## Current structure

```txt
src/
  domain/
    auth/
      index.ts
      types.ts
    ledger/
      index.ts
      types.ts

  application/
    ai.ts
    auth/token-manager.ts
    ledger-display/telegram-adapter.ts
    transaction-manager.ts

  ports/
    auth-identity-repo.ts
    auth-otp-messenger.ts
    auth-session.ts
    ledger-display.ts
    ledger-repo.ts

  adapters/
    d1/
    telegram/
    trpc/

  bootstrap/
    create-app-context.ts

  shared/contracts/
    auth.ts
    ledger.ts
```

---

## Composition root

`src/bootstrap/create-app-context.ts` is the dependency wiring entry point.

It constructs:

- ledger module (repo + optional display adapter)
- user stores
- transaction manager
- auth module factories (`createSessionAuthModule`, `createOtpAuthModule`)

Entrypoints (`index.tsx`, `adapters/trpc/router.ts`, telegram handlers) consume this context instead of wiring dependencies ad hoc.

---

## Guardrails

Architecture checks are enforced with:

- `npm run check:architecture`
- `npm run ci:architecture`

Rule: domain code cannot import from `adapters/`, `application/`, or `bootstrap/`.
