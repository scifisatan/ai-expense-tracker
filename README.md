````markdown
# Telegram Budget Bot

A simple, maintainable Telegram-based budget tracker that extracts transactions from text, updates a pinned balance message, and keeps your group's balance visible.

## Features

- Extract transactions (deposits/expenses) using an AI-based extractor
- Maintain and pin a shared balance in group chats
- Reusable services and modular code for future extensions

## Project Structure (opinionated)

```
src/
  bot/
    index.ts              # Bot factory and bootstrapping
    handlers.ts           # Message handlers
    transactions.ts       # Compute totals and types
    balance.ts            # Balance service (encapsulates pin/get)
    types.ts              # Domain types
  server/
    app.ts                # Express app factory
    main.ts               # App entrypoint and webhook setup
  services/
    ai.ts                 # AI extraction service
    telegram.ts           # Telegram API wrapper
  config/
    env.ts                # typed environment variables
    logger.ts             # minimal logger abstraction
  utils/
    parser.ts             # parsing helpers
  test/                   # unit tests (Bun)
  index.ts                # public exports
```

## Environment Variables

Create a `.env` file in the project root with the following values (example):

```
TOKEN=<telegram_bot_token>
URL=<public_https_url_for_webhook>
PORT=3001
GROQ_TOKEN=<groq_ai_key>
```

`URL` is required when using webhook mode and deploying to a public server.

## Development

Install dependencies and run the project for local development (Bun):

```bash
bun install
bun run dev
```

Run tests:

```bash
bun test
```

## Production

Build and run (TypeScript -> JS then run):

```bash
bun install
bun run build
node ./dist/server/main.js
```

## Best Practices in this refactor

- Use an app factory and entrypoint for easy testing and separation of concerns.
- Create small, composable services (AI service, Telegram wrapper, Balance service) for easier unit testing and maintainability.
- Export `createBot` for test-time dependency injection.
- Replace console.log usage with a `logger` abstraction for structured logs.
- Add unit tests for core pure functions (totals and parsing).

## Next steps

- Add CI (GitHub Actions) to run lint, typecheck, and tests.
- Add E2E tests for webhook flow using a mock Telegram client.
- Add a persistent storage option for transactions and balances.

```

```
````
