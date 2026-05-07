import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { router } from "@api/router";
import type { AppEnv } from "@/apps/env";
import { SESSION_COOKIE } from "@/utils/constants";
import { getCookie } from "@/utils/cookies";

const apiRoutes = new Hono<AppEnv>();

const getSessionChatId = (request: Request): number | null => {
  const cookieHeader = request.headers.get("cookie");
  const token = getCookie(cookieHeader, SESSION_COOKIE);

  if (!token) return null;

  try {
    const [payload] = token.split(".");
    const decoded = JSON.parse(atob(payload));
    return decoded.chatId ?? null;
  } catch {
    return null;
  }
};

apiRoutes.all("/*", async (c, next) => {
  const chatId = getSessionChatId(c.req.raw); // need this for auth
  const handler = trpcServer({
    router,
    endpoint: "/api",
    createContext: () => ({
      chatId,
      db: c.env.DB,
      env: c.env,
    }),
  });

  return handler(c, next);
});

export default apiRoutes;