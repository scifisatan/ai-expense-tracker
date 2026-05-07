import { createD1AuthIdentityRepo } from "../adapters/d1/auth-identity-repo";
import { createD1LedgerRepo } from "../adapters/d1/ledger-repo";
import { createTelegramOtpMessenger } from "../adapters/telegram/auth-otp-messenger";
import { createTransactionManager } from "../application/transaction-manager";
import { TokenSessionManager } from "../application/auth/token-manager";
import { TelegramLedgerAdapter } from "../application/ledger-display/telegram-adapter";
import { createAuthModule } from "../domain/auth";
import { createLedgerModule } from "../domain/ledger";
import { createUserConfigStore } from "../storage/user-config";
import { createUserStore } from "../storage/user-store";

const DEFAULT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

type AppRuntimeEnv = {
  BOT_TOKEN?: string;
  AI_MODEL?: string;
  WEBAPP_AUTH_SECRET?: string;
};

export const getAuthSecret = (env: AppRuntimeEnv) =>
  env.WEBAPP_AUTH_SECRET ?? env.BOT_TOKEN ?? null;

export const createAppContext = (config: { db: D1Database; env: AppRuntimeEnv }) => {
  const { db, env } = config;
  const token = env.BOT_TOKEN;
  const authSecret = getAuthSecret(env);
  const display = token ? new TelegramLedgerAdapter(token) : undefined;

  const ledger = createLedgerModule({
    repo: createD1LedgerRepo(db),
    display,
  });

  const userStore = createUserStore(db);
  const userConfigStore = createUserConfigStore(db);

  const transactionManager = display
    ? createTransactionManager({
        aiModel: env.AI_MODEL ?? DEFAULT_MODEL,
        ledger,
      })
    : null;

  const createSessionAuthModule = () => {
    if (!authSecret) throw new Error("Missing auth secret");

    return createAuthModule({
      session: new TokenSessionManager(authSecret),
    });
  };

  const createOtpAuthModule = () => {
    if (!token) throw new Error("Missing bot token");
    if (!authSecret) throw new Error("Missing auth secret");

    return createAuthModule({
      identityRepo: createD1AuthIdentityRepo(db),
      otpMessenger: createTelegramOtpMessenger(token),
      session: new TokenSessionManager(authSecret),
    });
  };

  return {
    ledger,
    userStore,
    userConfigStore,
    transactionManager,
    createSessionAuthModule,
    createOtpAuthModule,
  };
};
