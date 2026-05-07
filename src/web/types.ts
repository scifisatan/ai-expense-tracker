import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../adapters/trpc/router";

type RouterOutput = inferRouterOutputs<AppRouter>;

type SessionResponse = RouterOutput["auth"]["session"];
type Transaction = RouterOutput["transactions"]["list"]["items"][number];
type Summary = RouterOutput["insights"]["summary"];

type SortKey = "id" | "amount" | "type" | "createdAt";
type SortDir = "asc" | "desc";

export { SessionResponse, Transaction, Summary, SortKey, SortDir };
