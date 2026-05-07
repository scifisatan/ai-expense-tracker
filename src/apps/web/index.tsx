/** @jsxImportSource hono/jsx */

import { Hono } from "hono";
import {
  Link,
  Script,
  ViteClient,
} from "vite-ssr-components/hono";

import type { AppEnv } from "@/apps/env";

const web = new Hono<AppEnv>();

web.get("/", (c) => {
  return c.html(
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />

        <title>Budget Bot</title>

        <ViteClient />
        <Script src="/src/apps/web/client.tsx" />
        <Link
          href="/src/apps/web/styles.css"
          rel="stylesheet"
        />
      </head>

      <body>
        <div id="root" />
      </body>
    </html>,
  );
});

export default web;