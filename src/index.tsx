/** @jsxImportSource hono/jsx */
import type { Update } from "grammy/types";
import { Hono } from "hono";
import { createBot } from "./bot";
import { createTransactionManager } from "./services/transaction-manager";
import { TelegramLedgerAdapter } from "./services/ledger-display/telegram-adapter";
import { TokenSessionManager } from "./services/auth/token-manager";
import { createTransactionStore } from "./storage/transaction-store";
import { Script, Link, ViteClient } from "vite-ssr-components/hono";
import { router } from "./router";
import { trpcServer } from "@hono/trpc-server";

export type CloudflareBindings = {
  BOT_TOKEN?: string;
  AI_MODEL?: string;
  WEBHOOK_URL?: string; // e.g. https://my-worker.workers.dev
  WEBAPP_AUTH_SECRET?: string;
  DB: D1Database;
  ASSETS?: Fetcher;
};

const app = new Hono<{ Bindings: CloudflareBindings }>();

let webhookInitPromise: Promise<void> | null = null;

const getAuthSecret = (env: CloudflareBindings) => env.WEBAPP_AUTH_SECRET ?? env.BOT_TOKEN ?? null;

const getSessionManager = (env: CloudflareBindings) => {
  const secret = getAuthSecret(env);
  if (!secret) throw new Error("Missing auth secret");
  return new TokenSessionManager(secret);
};

const parseCookies = (cookieHeader: string | null) => {
  const out = new Map<string, string>();
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey || rest.length === 0) continue;
    out.set(rawKey, rest.join("="));
  }
  return out;
};

const getSessionChatId = async (req: Request, env: CloudflareBindings): Promise<number | null> => {
  const cookies = parseCookies(req.headers.get("cookie"));
  const token = cookies.get("budget_session");
  if (!token) return null;

  try {
    const manager = getSessionManager(env);
    const payload = await manager.verifySession(token);
    return payload?.chatId ?? null;
  } catch {
    return null;
  }
};

const getTransactionManager = (env: CloudflareBindings) =>
  createTransactionManager({
    db: env.DB,
    aiModel: env.AI_MODEL ?? "meta-llama/llama-4-scout-17b-16e-instruct",
    display: new TelegramLedgerAdapter(env.BOT_TOKEN!),
  });

const ensureWebhookConfigured = async (env: CloudflareBindings) => {
  if (!env.WEBHOOK_URL) return;

  const token = env.BOT_TOKEN;
  if (!token) {
    console.warn("[webhook-auto-setup-skipped] Missing BOT_TOKEN");
    return;
  }

  if (webhookInitPromise) {
    await webhookInitPromise;
    return;
  }

  webhookInitPromise = (async () => {
    const desiredWebhookUrl = `${env.WEBHOOK_URL!.replace(/\/$/, "")}/bot${token}`;
    const telegramBase = `https://api.telegram.org/bot${token}`;

    const infoRes = await fetch(`${telegramBase}/getWebhookInfo`);
    const infoJson = (await infoRes.json()) as {
      ok?: boolean;
      result?: { url?: string };
      description?: string;
    };

    if (!infoRes.ok || !infoJson.ok) {
      throw new Error(`getWebhookInfo failed: ${infoJson.description ?? `HTTP ${infoRes.status}`}`);
    }

    const currentUrl = infoJson.result?.url ?? "";
    if (currentUrl === desiredWebhookUrl) {
      console.info("[webhook-auto-setup] already configured", { url: desiredWebhookUrl });
      return;
    }

    const setRes = await fetch(`${telegramBase}/setWebhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: desiredWebhookUrl }),
    });

    const setJson = (await setRes.json()) as {
      ok?: boolean;
      description?: string;
    };

    if (!setRes.ok || !setJson.ok) {
      throw new Error(`setWebhook failed: ${setJson.description ?? `HTTP ${setRes.status}`}`);
    }

    console.info("[webhook-auto-setup] configured", { url: desiredWebhookUrl });
  })().catch((err) => {
    console.error("[webhook-auto-setup-error]", err);
    webhookInitPromise = null;
  });

  await webhookInitPromise;
};

app.use("*", async (c, next) => {
  await ensureWebhookConfigured(c.env);
  await next();
});

app.get("/", (c) => c.redirect("/app"));

app.get("/health", (c) => {
  return c.json({
    ok: true,
    checks: {
      hasBotToken: Boolean(c.env.BOT_TOKEN),
      hasEffectiveToken: Boolean(c.env.BOT_TOKEN),
      hasDbBinding: Boolean(c.env.DB),
      hasAiModel: Boolean(c.env.AI_MODEL),
      hasWebhookUrl: Boolean(c.env.WEBHOOK_URL),
      hasWebAppAuthSecret: Boolean(c.env.WEBAPP_AUTH_SECRET),
      hasAssetsBinding: Boolean(c.env.ASSETS),
    },
  });
});

app.all("/api/*", async (c, next) => {
  const chatId = await getSessionChatId(c.req.raw, c.env);
  const handler = trpcServer({
    router,
    endpoint: "/api",
    createContext: () => ({
      chatId,
      db: c.env.DB,
      env: c.env,
    }),
  });
  const res = await handler(c, next);
  return res;
});

app.get("/webhook", (c) =>
  c.json({ ok: true, message: "Webhook endpoint is alive. Use POST for Telegram updates." }),
);

const handleUpdate = async (c: any, source: "webhook" | "token-path") => {
  try {
    const update = (await c.req.json()) as Update;
    console.info("[webhook-received]", {
      source,
      updateId: update.update_id,
      type: Object.keys(update).filter((k) => k !== "update_id")[0],
    });

    const bot = createBot(c.env);
    await bot.init();
    await bot.handleUpdate(update);

    return c.json({ ok: true });
  } catch (error) {
    console.error("[webhook-error]", error);
    return c.json({ ok: false, error: "Failed to process update" }, 500);
  }
};

app.post("/webhook", async (c) => handleUpdate(c, "webhook"));

// Supports Telegram webhook URLs in the form /bot<token> (and /bot/<token>)
app.post("/bot*", async (c) => {
  const effectiveToken = c.env.BOT_TOKEN;
  const path = c.req.path;
  let pathToken = path.startsWith("/bot") ? path.slice("/bot".length) : "";
  if (pathToken.startsWith("/")) pathToken = pathToken.slice(1);

  if (!effectiveToken || pathToken !== effectiveToken) {
    console.warn("[webhook-rejected]", {
      reason: "token_mismatch",
      hasEffectiveToken: Boolean(effectiveToken),
      path,
    });
    return c.json({ ok: false, error: "Invalid bot token in path" }, 403);
  }

  return handleUpdate(c, "token-path");
});

app.get("/app", (c) => {
  return c.html(
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Budget Bot</title>
        <ViteClient />
        <Script src="/src/web/client.tsx" />
        <Link href="/src/web/styles.css" rel="stylesheet" />
      </head>
      <body>
        <div id="root" />
      </body>
    </html>,
  );
});
export default app;
