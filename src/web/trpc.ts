import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../adapters/trpc/router";

export const trpc = createTRPCReact<AppRouter>();
