/** @jsxImportSource hono/jsx */
import { trpcServer } from "@hono/trpc-server";
import type { Update } from "grammy/types";
import { Hono, type Context } from "hono";
import { Link, Script, ViteClient } from "vite-ssr-components/hono";
import { createBot } from "./bot";
import { router } from "./adapters/trpc/router";
import { createAppContext, getAuthSecret } from "./bootstrap/create-app-context";

export type CloudflareBindings = {
  BOT_TOKEN?: string;
  AI_MODEL?: string;
  WEBHOOK_URL?: string; // e.g. https://my-worker.workers.dev
  WEBAPP_AUTH_SECRET?: string;
  DB: D1Database;
  ASSETS?: Fetcher;
};

type AppEnv = { Bindings: CloudflareBindings };
type AppContext = Context<AppEnv>;

const SESSION_COOKIE = "budget_session";

const app = new Hono<AppEnv>();
let webhookInitPromise: Promise<void> | null = null;

const getAuth = (env: CloudflareBindings) => {
  const authSecret = getAuthSecret(env);
  if (!authSecret) throw new Error("Missing auth secret");

  return createAppContext({ db: env.DB, env }).createSessionAuthModule();
};

const parseCookies = (cookieHeader: string | null) => {
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;

  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey || rest.length === 0) continue;
    cookies.set(rawKey, rest.join("="));
  }

  return cookies;
};

const getSessionChatId = async (
  request: Request,
  env: CloudflareBindings,
): Promise<number | null> => {
  const cookies = parseCookies(request.headers.get("cookie"));
  const sessionToken = cookies.get(SESSION_COOKIE);
  if (!sessionToken) return null;

  try {
    const auth = getAuth(env);
    return auth.getSessionChatId(sessionToken);
  } catch {
    return null;
  }
};

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
  })().catch((error) => {
    console.error("[webhook-auto-setup-error]", error);
    webhookInitPromise = null;
  });

  await webhookInitPromise;
};

const getPathToken = (path: string) => {
  if (!path.startsWith("/bot")) return "";
  const rawPathToken = path.slice("/bot".length);
  return rawPathToken.startsWith("/") ? rawPathToken.slice(1) : rawPathToken;
};

const handleUpdate = async (c: AppContext, source: "webhook" | "token-path") => {
  try {
    const update = (await c.req.json()) as Update;
    const updateType = Object.keys(update).find((key) => key !== "update_id");

    console.info("[webhook-received]", {
      source,
      updateId: update.update_id,
      type: updateType,
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

  return handler(c, next);
});

app.get("/webhook", (c) =>
  c.json({ ok: true, message: "Webhook endpoint is alive. Use POST for Telegram updates." }),
);

app.post("/webhook", async (c) => handleUpdate(c, "webhook"));

// Supports Telegram webhook URLs in the form /bot<token> (and /bot/<token>)
app.post("/bot*", async (c) => {
  const effectiveToken = c.env.BOT_TOKEN;
  const pathToken = getPathToken(c.req.path);

  if (!effectiveToken || pathToken !== effectiveToken) {
    console.warn("[webhook-rejected]", {
      reason: "token_mismatch",
      hasEffectiveToken: Boolean(effectiveToken),
      path: c.req.path,
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
