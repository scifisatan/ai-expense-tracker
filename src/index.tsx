/** @jsxImportSource hono/jsx */
import type { Update } from 'grammy/types';
import { Hono } from 'hono';
import { createBot } from './bot';
import { createTransactionManager } from './services/transaction-manager';
import { TelegramLedgerAdapter } from './services/ledger-display/telegram-adapter';
import { TokenSessionManager } from './services/auth/token-manager';
import { createTransactionStore } from './storage/transaction-store';
import { Script, Link, ViteClient } from 'vite-ssr-components/hono'


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
  if (!secret) throw new Error('Missing auth secret');
  return new TokenSessionManager(secret);
};

const parseCookies = (cookieHeader: string | null) => {
  const out = new Map<string, string>();
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (!rawKey || rest.length === 0) continue;
    out.set(rawKey, rest.join('='));
  }
  return out;
};

const getSessionChatId = async (req: Request, env: CloudflareBindings): Promise<number | null> => {
  const cookies = parseCookies(req.headers.get('cookie'));
  const token = cookies.get('budget_session');
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
    aiModel: env.AI_MODEL ?? 'meta-llama/llama-4-scout-17b-16e-instruct',
    display: new TelegramLedgerAdapter(env.BOT_TOKEN!),
  });

const ensureWebhookConfigured = async (env: CloudflareBindings) => {
  if (!env.WEBHOOK_URL) return;

  const token = env.BOT_TOKEN;
  if (!token) {
    console.warn('[webhook-auto-setup-skipped] Missing BOT_TOKEN');
    return;
  }

  if (webhookInitPromise) {
    await webhookInitPromise;
    return;
  }

  webhookInitPromise = (async () => {
    const desiredWebhookUrl = `${env.WEBHOOK_URL!.replace(/\/$/, '')}/bot${token}`;
    const telegramBase = `https://api.telegram.org/bot${token}`;

    const infoRes = await fetch(`${telegramBase}/getWebhookInfo`);
    const infoJson = (await infoRes.json()) as {
      ok?: boolean;
      result?: { url?: string };
      description?: string;
    };

    if (!infoRes.ok || !infoJson.ok) {
      throw new Error(
        `getWebhookInfo failed: ${infoJson.description ?? `HTTP ${infoRes.status}`}`
      );
    }

    const currentUrl = infoJson.result?.url ?? '';
    if (currentUrl === desiredWebhookUrl) {
      console.info('[webhook-auto-setup] already configured', { url: desiredWebhookUrl });
      return;
    }

    const setRes = await fetch(`${telegramBase}/setWebhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: desiredWebhookUrl }),
    });

    const setJson = (await setRes.json()) as {
      ok?: boolean;
      description?: string;
    };

    if (!setRes.ok || !setJson.ok) {
      throw new Error(`setWebhook failed: ${setJson.description ?? `HTTP ${setRes.status}`}`);
    }

    console.info('[webhook-auto-setup] configured', { url: desiredWebhookUrl });
  })().catch((err) => {
    console.error('[webhook-auto-setup-error]', err);
    webhookInitPromise = null;
  });

  await webhookInitPromise;
};

const serveFromAssets = async (c: any) => {
  if (!c.env.ASSETS) {
    return c.json(
      { ok: false, error: 'ASSETS binding is not configured. Run web build + deploy with assets.' },
      500
    );
  }
  return c.env.ASSETS.fetch(c.req.raw);
};

app.get('/assets/*', serveFromAssets);

app.use('*', async (c, next) => {
  await ensureWebhookConfigured(c.env);
  await next();
});

app.get('/', (c) => c.redirect('/app'));

app.get('/health', (c) => {
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

app.post('/api/auth/request-otp', async (c) => {
  const token = c.env.BOT_TOKEN;
  if (!token) return c.json({ error: 'Missing bot token' }, 500);

  const body = (await c.req.json().catch(() => null)) as { username?: string; chatId?: number } | null;
  let chatId = Number(body?.chatId);
  const username = body?.username?.replace(/^@/, '').trim();

  // If username is provided, look up the user_id (which acts as chatId for login)
  if (!Number.isFinite(chatId) && username) {
    const user = await c.env.DB
      .prepare('SELECT user_id FROM users WHERE LOWER(username) = LOWER(?)')
      .bind(username)
      .first<{ user_id: number }>();

    if (user) {
      chatId = user.user_id;
    } else {
      return c.json({
        error: 'Username not found. Please send /start to the bot first to register.'
      }, 404);
    }
  }

  if (!Number.isFinite(chatId)) return c.json({ error: 'Username or Chat ID is required.' }, 400);

  const manager = getSessionManager(c.env);
  const { challengeToken, otp } = await manager.issueOtpChallenge(chatId);

  const telegramRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: `🔐 Budget Bot Web Login OTP: ${otp}\n\nThis code expires in 5 minutes.`,
    }),
  });

  const telegramJson = (await telegramRes.json().catch(() => null)) as {
    ok?: boolean;
    description?: string;
  } | null;

  if (!telegramRes.ok || !telegramJson?.ok) {
    return c.json(
      {
        error:
          telegramJson?.description ??
          'Could not send OTP to Telegram. Ensure you already started the bot in that chat.',
      },
      400
    );
  }

  return c.json({ challengeToken, expiresInSeconds: 300 });
});

app.post('/api/auth/verify-otp', async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    username?: string;
    chatId?: number;
    otp?: string;
    challengeToken?: string;
  } | null;

  let chatId = Number(body?.chatId);
  const username = body?.username?.replace(/^@/, '').trim();
  const otp = String(body?.otp ?? '').trim();
  const challengeToken = body?.challengeToken ?? '';

  // Resolve chatId from username if not provided
  if (!Number.isFinite(chatId) && username) {
    const user = await c.env.DB
      .prepare('SELECT user_id FROM users WHERE LOWER(username) = LOWER(?)')
      .bind(username)
      .first<{ user_id: number }>();

    if (!user) {
      return c.json(
        { error: 'Username not found. Please send /start to the bot first.' },
        404
      );
    }

    chatId = user.user_id;
  }

  if (!Number.isFinite(chatId) || otp.length !== 6 || !challengeToken) {
    return c.json({ error: 'Invalid OTP verification payload.' }, 400);
  }

  const manager = getSessionManager(c.env);
  const isValid = await manager.verifyOtpChallenge(
    challengeToken,
    chatId,
    otp
  );

  if (!isValid) {
    return c.json({ error: 'Invalid or expired OTP.' }, 400);
  }

  const sessionToken = await manager.issueSession(chatId);

  c.header(
    'set-cookie',
    `budget_session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`
  );

  return c.json({ ok: true });
});

app.get('/api/auth/session', async (c) => {
  const chatId = await getSessionChatId(c.req.raw, c.env);
  if (!chatId) return c.json({ authenticated: false, chatId: null });
  return c.json({ authenticated: true, chatId });
});

app.post('/api/auth/logout', (c) => {
  c.header('set-cookie', 'budget_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
  return c.json({ ok: true });
});

app.get('/api/transactions', async (c) => {
  const chatId = await getSessionChatId(c.req.raw, c.env);
  if (!chatId) return c.json({ error: 'Unauthorized' }, 401);

  const requested = Number(c.req.query('limit') ?? 50);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 200) : 50;

  const store = createTransactionStore(c.env.DB);
  const items = await store.listRecent(chatId, limit);
  return c.json({ items });
});

app.patch('/api/transactions/:id', async (c) => {
  const chatId = await getSessionChatId(c.req.raw, c.env);
  if (!chatId) return c.json({ error: 'Unauthorized' }, 401);

  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'Invalid transaction id.' }, 400);

  const body = (await c.req.json().catch(() => null)) as {
    amount?: number;
    type?: string;
    note?: string | null;
  } | null;

  const manager = getTransactionManager(c.env);
  try {
    const { newBalance } = await manager.updateTransaction(chatId, id, body ?? {});
    return c.json({ ok: true, newBalance });
  } catch (err: any) {
    if (err.message === 'TRANSACTION_NOT_FOUND') return c.json({ error: 'Not found' }, 404);
    throw err;
  }
});

app.delete('/api/transactions', async (c) => {
  const chatId = await getSessionChatId(c.req.raw, c.env);
  if (!chatId) return c.json({ error: 'Unauthorized' }, 401);

  const body = (await c.req.json().catch(() => null)) as { ids?: number[] } | null;
  const ids = body?.ids;

  if (!Array.isArray(ids) || ids.length === 0) {
    return c.json({ error: 'Invalid or empty ids array.' }, 400);
  }

  const manager = getTransactionManager(c.env);
  try {
    const { newBalance } = await manager.deleteTransactions(chatId, ids);
    return c.json({ ok: true, newBalance });
  } catch (err: any) {
    throw err;
  }
});

app.get('/api/insights/summary', async (c) => {
  const chatId = await getSessionChatId(c.req.raw, c.env);
  if (!chatId) return c.json({ error: 'Unauthorized' }, 401);

  const row = await c.env.DB
    .prepare(
      `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'Income' THEN amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type = 'Expense' THEN amount ELSE 0 END), 0) AS expense,
        COALESCE(SUM(CASE WHEN type = 'Income' THEN amount ELSE -amount END), 0) AS net,
        COUNT(*) AS transactions
      FROM transactions
      WHERE chat_id = ?
    `
    )
    .bind(chatId)
    .first<{ income: number; expense: number; net: number; transactions: number }>();

  return c.json({
    income: Number(row?.income ?? 0),
    expense: Number(row?.expense ?? 0),
    net: Number(row?.net ?? 0),
    transactions: Number(row?.transactions ?? 0),
  });
});

app.get('/webhook', (c) =>
  c.json({ ok: true, message: 'Webhook endpoint is alive. Use POST for Telegram updates.' })
);

const handleUpdate = async (c: any, source: 'webhook' | 'token-path') => {
  try {
    const update = (await c.req.json()) as Update;
    console.info('[webhook-received]', {
      source,
      updateId: update.update_id,
      type: Object.keys(update).filter((k) => k !== 'update_id')[0],
    });

    const bot = createBot(c.env);
    await bot.init();
    await bot.handleUpdate(update);

    return c.json({ ok: true });
  } catch (error) {
    console.error('[webhook-error]', error);
    return c.json({ ok: false, error: 'Failed to process update' }, 500);
  }
};

app.post('/webhook', async (c) => handleUpdate(c, 'webhook'));

// Supports Telegram webhook URLs in the form /bot<token> (and /bot/<token>)
app.post('/bot*', async (c) => {
  const effectiveToken = c.env.BOT_TOKEN;
  const path = c.req.path;
  let pathToken = path.startsWith('/bot') ? path.slice('/bot'.length) : '';
  if (pathToken.startsWith('/')) pathToken = pathToken.slice(1);

  if (!effectiveToken || pathToken !== effectiveToken) {
    console.warn('[webhook-rejected]', {
      reason: 'token_mismatch',
      hasEffectiveToken: Boolean(effectiveToken),
      path,
    });
    return c.json({ ok: false, error: 'Invalid bot token in path' }, 403);
  }

  return handleUpdate(c, 'token-path');
});

app.get('/app', (c) => {
  return c.html(
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Budget Bot</title>
        <ViteClient />
        <Script src='/src/web/client.tsx' />
        <Link href='/src/web/styles.css' rel='stylesheet' />
      </head>
      <body>
        <div id='root' />
      </body>
    </html>
  )
})
export default app;
