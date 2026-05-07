type SessionResponse = { authenticated: boolean; chatId: number | null };
type Transaction = {
  id: number;
  amount: number;
  type: string;
  note: string | null;
  createdAt: string;
};
type Summary = { income: number; expense: number; net: number; transactions: number };
type SortKey = "id" | "amount" | "type" | "createdAt";
type SortDir = "asc" | "desc";

export { SessionResponse, Transaction, Summary, SortKey, SortDir };
