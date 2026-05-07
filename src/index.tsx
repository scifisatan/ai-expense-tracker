import { Hono } from "hono";

import apiRoutes from "@api/index";
import botRoutes from "@bot/index";
import webRoutes from "@web/index";

import type { AppEnv } from "@/apps/env";

const app = new Hono<AppEnv>();

app.route("/", botRoutes);
app.route("/app", webRoutes);
app.route("/api", apiRoutes);

export default app;