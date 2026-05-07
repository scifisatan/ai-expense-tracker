
import { createD1LedgerRepo } from "./ledger-repo";
import { createTelegramOtpMessenger } from "./auth-otp-messenger";
import { createTransactionManager } from "./transaction-manager";
import { TokenSessionManager } from "./token-manager";
import { createAuthModule } from "./auth-module";
import { createLedgerModule } from "./ledger-module";
import { createUserConfigStore } from "./user-config";
import { createUserStore } from "./user-store";

const DEFAULT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

type AppRuntimeEnv = {
  BOT_TOKEN?: string;
  AI_MODEL?: string;
};

export const createAppContext = (config: { db: D1Database; env: AppRuntimeEnv }) => {
  const { db, env } = config;
  const token = env.BOT_TOKEN;

  const ledger = createLedgerModule({
    repo: createD1LedgerRepo(db),
  });

  const userStore = createUserStore(db);
  const userConfigStore = createUserConfigStore(db);

  const transactionManager = createTransactionManager({
        aiModel: env.AI_MODEL ?? DEFAULT_MODEL,
        ledger,
      })

  const createSessionAuthModule = () => {
    if (!token) throw new Error("Missing auth secret");

    return createAuthModule({
      session: new TokenSessionManager(token),
    });
  };

  const createOtpAuthModule = () => {
    if (!token) throw new Error("Missing bot token");

    return createAuthModule({
      otpMessenger: createTelegramOtpMessenger(token),
      session: new TokenSessionManager(token),
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
