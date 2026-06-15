import type { AppDb } from "@/db/client";

import { createTransactionsRepo } from "./transactions";
import { createSettingsRepo } from "./settings";
import { createAccountsRepo } from "./accounts";
import { createCategoriesRepo } from "./categories";
import { createTelegramRepo } from "./telegram";

export const createRepositories = (db: AppDb) => ({
  transactions: createTransactionsRepo(db),
  settings: createSettingsRepo(db),
  accounts: createAccountsRepo(db),
  categories: createCategoriesRepo(db),
  telegram: createTelegramRepo(db),
});

export type ApiRepositories = ReturnType<typeof createRepositories>;
