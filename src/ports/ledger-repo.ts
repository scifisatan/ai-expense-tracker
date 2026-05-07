import type {
  BalanceProjection,
  LedgerTransaction,
  LedgerTransactionPatch,
  NewLedgerTransaction,
} from "../domain/ledger/types";

export interface LedgerRepo {
  listRecent(chatId: number, limit: number): Promise<LedgerTransaction[]>;
  getSummary(chatId: number): Promise<BalanceProjection>;
  addMany(
    chatId: number,
    userId: number,
    items: NewLedgerTransaction[],
    fallbackNote?: string,
  ): Promise<void>;
  getById(chatId: number, id: number): Promise<LedgerTransaction | null>;
  updateById(chatId: number, id: number, patch: LedgerTransactionPatch): Promise<void>;
  deleteMany(chatId: number, ids: number[]): Promise<void>;
}
