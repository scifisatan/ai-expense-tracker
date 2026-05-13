import { t, type ApiServices } from "./trpc"
import { authRouter } from "./routes/auth"
import { transactionsRouter } from "./routes/transactions"
import { insightsRouter } from "./routes/insights"

export { type ApiServices }

export const router = t.router({
  auth: authRouter,
  transactions: transactionsRouter,
  insights: insightsRouter
})

export type APIRouter = typeof router
