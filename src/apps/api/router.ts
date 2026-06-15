import { t } from "./trpc";
import { authRouter } from "./routes/auth";
import { transactionsRouter } from "./routes/transactions";
import { insightsRouter } from "./routes/insights";
import { ledgerRouter } from "./routes/ledger";
import { settingsRouter } from "./routes/settings";
import { categoriesRouter } from "./routes/categories";
import { telegramRouter } from "./routes/telegram";

export const router = t.router({
  auth: authRouter,
  transactions: transactionsRouter,
  insights: insightsRouter,
  ledger: ledgerRouter,
  settings: settingsRouter,
  categories: categoriesRouter,
  telegram: telegramRouter,
});

export type APIRouter = typeof router;
