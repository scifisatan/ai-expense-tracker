import type { AppDb } from "@/db/client";

import { createTransactionsRepo } from "./transactions";
import { createAccountsRepo } from "./accounts";
import { createCategoriesRepo } from "./categories";
import { createTelegramRepo } from "./telegram";
import { createCyclesRepo } from "./cycles";
import { createPacerRepo } from "./pacer";
import { createQueueRepo } from "./queue";

export const createRepositories = (db: AppDb) => ({
  transactions: createTransactionsRepo(db),
  accounts: createAccountsRepo(db),
  categories: createCategoriesRepo(db),
  telegram: createTelegramRepo(db),
  cycles: createCyclesRepo(db),
  pacer: createPacerRepo(db),
  queue: createQueueRepo(db),
});

export type ApiRepositories = ReturnType<typeof createRepositories>;
