import { Hono } from "hono";
import type { AppEnv } from "@/apps/env";

import { router } from "@api/router";
import { trpcServer } from "@hono/trpc-server";

import { createDb } from "@/db/client";
import { createRepositories } from "@api/repositories";

import { getCookie } from "@/utils/cookies";
import { SESSION_COOKIE } from "@/utils/constants";
import { createTokenSession } from "@api/lib/token-session";
import type { ApiRepositories } from "@api/repositories";
import oauthRoutes from "@api/routes/oauth";

const apiRoutes = new Hono<AppEnv>();

// Resolve the authenticated account from the session cookie, enforcing token
// revocation: the signed tokenVersion must still match the account's current one.
const getSessionAccountId = async (
  request: Request,
  repos: ApiRepositories,
  secret?: string,
): Promise<string | null> => {
  const cookieHeader = request.headers.get("cookie");
  const token = getCookie(cookieHeader, SESSION_COOKIE);

  if (!token || !secret) return null;

  const session = await createTokenSession(secret).verifySession(token);
  if (!session) return null;

  const account = await repos.accounts.findById(session.accountId);
  if (!account || account.tokenVersion !== session.tokenVersion) return null;

  return session.accountId;
};

// OAuth (Google) login/callback — needs HTTP redirects, so handled outside tRPC.
apiRoutes.route("/auth", oauthRoutes);

apiRoutes.all("/*", async (c, next) => {
  const db = createDb(c.env.DB);
  const repos = createRepositories(db);
  const accountId = await getSessionAccountId(c.req.raw, repos, c.env.SESSION_SECRET);

  const handler = trpcServer({
    router,
    endpoint: "/api",
    createContext: () => ({
      db,
      repos,
      env: c.env,
      accountId,
      actor: "web" as const,
    }),
  });

  return handler(c, next);
});

export default apiRoutes;
