import { Hono } from "hono";

import apiRoutes from "@api/index";
import botRoutes from "@bot/index";
import webRoutes from "@web/index";
import { runPacerTick } from "@api/cron/pacerTick";
import { createDb } from "@/db/client";

import type { AppEnv, CloudflareBindings } from "@/apps/env";

const app = new Hono<AppEnv>();

app.get("/", (c) => c.redirect("/app"));

app.route("/app", webRoutes);
app.route("/api", apiRoutes);
app.route("/", botRoutes);

export default {
  fetch: app.fetch,
  scheduled: async (_event: ScheduledEvent, env: CloudflareBindings, ctx: ExecutionContext) => {
    ctx.waitUntil(runPacerTick(createDb(env.DB), env));
  },
};
