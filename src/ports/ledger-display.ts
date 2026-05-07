export interface LedgerDisplay {
  updateBalance(chatId: number, balance: number): Promise<void>;
}
