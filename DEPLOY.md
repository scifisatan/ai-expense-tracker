# Configuration & Deployment

End-to-end guide for configuring and deploying the Budget App to **Cloudflare Workers**.
For an architectural overview see [CONTEXT.md](./CONTEXT.md); for a quick command reference
see [README.md](./README.md).

The app is a single Worker that serves the Telegram webhook, the web dashboard, and the tRPC
API. Deploying it means provisioning a few Cloudflare resources, wiring up Google OAuth and a
Telegram bot, supplying secrets/vars, running migrations, and pointing the Telegram webhook
at the deployed Worker.

---

## 1. Prerequisites

- A **Cloudflare account** (Workers + D1 + KV + Workers AI are all on the free tier).
- **Node.js** 20+ and **pnpm** (`npm i -g pnpm`). npm also works.
- **Wrangler** is installed as a dev dependency, so use it via `npx wrangler …` (or
  `pnpm exec wrangler …`). Authenticate once:
  ```bash
  npx wrangler login
  ```
- A **Telegram bot token** — see step 4a.
- A **Groq API key** — see step 4b.
- A **Google OAuth 2.0 client** — see step 4c.

> Steps 4a–4c below walk through exactly where in each provider's dashboard to obtain these
> credentials.

---

## 2. Install

```bash
pnpm install
```

---

## 3. Provision Cloudflare resources

### D1 database

```bash
npx wrangler d1 create telegram_budget_bot
```

Copy the returned `database_id` into `wrangler.jsonc` under `d1_databases[0].database_id`.
Keep the `binding` as `DB` and `database_name` as `telegram_budget_bot`.

### KV namespace

Used for serialized bot info and the per-account daily AI rate-limit counters.

```bash
npx wrangler kv namespace create BOT_INFO
```

Put the returned `id` into `wrangler.jsonc` under `kv_namespaces[0].id` (binding `BOT_INFO`).

### Workers AI

No provisioning needed — the `ai` binding (`AI`) in `wrangler.jsonc` enables it. It is used to
route Groq calls through a Cloudflare AI Gateway when `AI_GATEWAY` is set.

### (Optional) AI Gateway

For observability, caching, and gateway-wide limits on AI calls:

1. In the Cloudflare dashboard → **AI** → **AI Gateway**, create a gateway and note its name.
2. Set the `AI_GATEWAY` var (step 5) to that name. Leave it as `""` to call Groq directly.

---

## 4. Obtain external credentials

This app needs three sets of credentials from outside Cloudflare. Here's exactly where to
get each one.

### 4a. Telegram bot token (`BOT_TOKEN`)

1. Open [@BotFather](https://t.me/BotFather) in Telegram and send `/newbot` (or `/mybots` →
   select an existing bot → **API Token**).
2. Follow the prompts to name the bot and choose a username.
3. BotFather replies with a token like `123456:ABC-DEF...` — that is your `BOT_TOKEN`.

### 4b. Groq API key (`GROQ_API_KEY`)

1. Go to the **Groq Console**: <https://console.groq.com> and sign in (or create an account).
2. In the left sidebar open **API Keys** (direct link: <https://console.groq.com/keys>).
3. Click **Create API Key**, give it a name, and **copy the key immediately** — Groq only
   shows the full value once. That copied value is your `GROQ_API_KEY`.
4. Make sure the model in `AI_MODEL` (default `meta-llama/llama-4-scout-17b-16e-instruct`) is
   one your Groq account can access; browse available models at
   <https://console.groq.com/docs/models>.

### 4c. Google OAuth client (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`)

1. In the [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials),
   pick or create a project, then click **Create Credentials → OAuth client ID**.
2. If prompted, configure the **OAuth consent screen** first (External user type is fine for
   testing; add your Google account as a test user).
3. Choose application type **Web application**.
4. Under **Authorized redirect URIs**, add a URI that matches
   `${APP_URL}/api/auth/google/callback` exactly for every environment you use:
   - Local: `http://localhost:3001/api/auth/google/callback`
   - Production: `https://<your-domain>/api/auth/google/callback`
5. Click **Create** and copy the **Client ID** and **Client secret** — these are your
   `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

---

## 5. Configure secrets & vars

### Vars (`wrangler.jsonc`)

Non-sensitive config lives in the `vars` block of `wrangler.jsonc`:

| Var              | Purpose                                              | Example                                         |
| ---------------- | ---------------------------------------------------- | ----------------------------------------------- |
| `APP_URL`        | Base URL; builds the OAuth redirect URI             | `https://budget.example.com`                    |
| `AI_MODEL`       | Groq model id                                        | `meta-llama/llama-4-scout-17b-16e-instruct`     |
| `AI_GATEWAY`     | Cloudflare AI Gateway name (`""` = call Groq direct) | `""`                                            |
| `AI_DAILY_LIMIT` | Per-account daily AI extraction cap (`0` disables)   | `50`                                            |

Also set the custom domain under `routes` if you serve on your own domain (see step 7).

### Secrets (production)

Sensitive values are stored as Worker secrets, **not** in `wrangler.jsonc`. Each command
prompts for the value — paste the credential you obtained in step 4:

```bash
npx wrangler secret put BOT_TOKEN            # from BotFather (step 4a)
npx wrangler secret put SESSION_SECRET       # a long random string: `openssl rand -hex 32`
npx wrangler secret put GOOGLE_CLIENT_ID     # Google Cloud Console credentials (step 4c)
npx wrangler secret put GOOGLE_CLIENT_SECRET # Google Cloud Console credentials (step 4c)
npx wrangler secret put GROQ_API_KEY         # Groq Console → API Keys (step 4b)
```

> `SESSION_SECRET` signs the session and OAuth-state cookies — it is independent of the bot
> token. Use a high-entropy value and keep it stable (rotating it invalidates all sessions).

### Secrets (local)

For local dev, copy the example and fill it in — `.dev.vars` is loaded automatically by
Wrangler/Vite and is gitignored:

```bash
cp .dev.vars.example .dev.vars
```

---

## 6. Run database migrations

Migrations live in `migrations/` (`0001`–`0006`).

```bash
# Local D1 (used by `npm run dev`)
npm run db:migrate:local

# Remote/production D1
npm run db:migrate:remote
```

> `0005_account_identity.sql` wipes the old Telegram-keyed tables and creates the
> account-first schema. `0006_drop_groq_api_key.sql` drops the obsolete per-account Groq key
> column. Run migrations against the remote DB **before** the first production deploy.

---

## 7. Deploy

```bash
npm run build      # vite build
npm run deploy     # builds, then deploys through Wrangler's Vite-generated redirect
```

The Vite/Cloudflare build intentionally writes two output folders:

- `dist/client` contains the browser assets generated from the SSR `<Script>` and `<Link>`
  entries.
- `dist/telegram_budget_bot` contains the Worker bundle and generated Wrangler config.

After `vite build`, the Cloudflare Vite plugin writes `.wrangler/deploy/config.json`, which
redirects root `wrangler deploy` to the generated config in `dist/telegram_budget_bot`. That
generated config points Wrangler at `../client`, so the dashboard assets are uploaded with
the Worker.

### Custom domain (optional)

`wrangler.jsonc` includes a `routes` entry with `custom_domain: true`. Point a domain you
control at the Worker by setting the `pattern` to your hostname and ensuring that domain is on
your Cloudflare account. Then set `APP_URL` to `https://<that-domain>` and add the matching
Google OAuth redirect URI (step 4). Without a custom domain, the Worker is reachable at its
`*.workers.dev` URL — use that as `APP_URL` instead.

---

## 8. Set the Telegram webhook

After the first deploy, tell Telegram where to send updates. The webhook is the Worker root
(`POST /`):

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://<your-worker-domain>/"
```

Verify it:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

---

## 9. Verify the deployment

1. Open `https://<your-domain>/app` and sign in with Google — an account is created with
   default categories.
2. In the dashboard, add a transaction (manual or natural language) and confirm it appears.
3. Message your bot, send `/link`, copy the code, and enter it in **Settings → Telegram**.
4. Send the bot a plain-language message like `spent 12.50 on coffee` — it should be logged
   and the pinned balance updated.

---

## 10. Local development

```bash
npm run dev        # Vite + Cloudflare plugin on http://localhost:3001
```

To exercise the Telegram bot locally, expose port `3001` with a tunnel (e.g. `ngrok http
3001`) and point the Telegram webhook at the tunnel URL (step 8). Set `APP_URL` in `.dev.vars`
to the tunnel URL and add the matching Google OAuth redirect URI.

Validation before deploying:

```bash
npm run build
npm run lint
npm run test
```

---

## 11. Troubleshooting

- **OAuth `redirect_uri_mismatch`** — the Google client's authorized redirect URI must equal
  `${APP_URL}/api/auth/google/callback` exactly (scheme, host, no trailing slash mismatch).
- **Bot not responding** — check `getWebhookInfo` for a `last_error_message`; confirm the
  webhook URL is the Worker root and `BOT_TOKEN` is set as a secret.
- **"connect your account" loop in chat** — the chat isn't linked; complete the `/link` →
  **Settings → Telegram** flow.
- **AI extraction does nothing / "limit reached"** — verify `GROQ_API_KEY` is set and valid
  (regenerate at <https://console.groq.com/keys>) and that `AI_MODEL` is a model your Groq
  account can access; an account hitting `AI_DAILY_LIMIT` is capped until the next UTC day
  (set `AI_DAILY_LIMIT=0` to disable).
- **D1 errors after deploy** — make sure `npm run db:migrate:remote` ran against the deployed
  database.
