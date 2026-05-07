import { Context as GrammyContext } from "grammy";
import { CloudflareBindings } from "@apps/env";

export type BotContext = GrammyContext & {
  env: CloudflareBindings;
};

export type TransactionItem = { amount: number; type: string; note?: string };

export type BalanceInfo = { balance: number | null; messageId?: number };
