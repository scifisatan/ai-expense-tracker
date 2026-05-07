import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { router } from "@api/router";
import type { AppEnv } from "@/apps/env";

const api = new Hono<AppEnv>();

api.all("/*", async (c, next) => {
  const handler = trpcServer({
    router,
    endpoint: "/api",
    createContext: () => ({
      db: c.env.DB,
      env: c.env,
    }),
  });

  return handler(c, next);
});

export default api;