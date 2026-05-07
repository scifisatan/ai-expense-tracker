import { createTRPCReact } from "@trpc/react-query"
import type { APIRouter } from "@api/router"

export const trpc = createTRPCReact<APIRouter>()
