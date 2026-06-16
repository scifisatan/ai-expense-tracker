/** @jsxImportSource hono/jsx */

import { Hono } from "hono"
import { Link, Script, ViteClient } from "vite-ssr-components/hono"

import type { AppEnv } from "@/apps/env"

const web = new Hono<AppEnv>()

web.get("/", (c) => {
  return c.html(
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        <title>Budget Bot</title>

        <ViteClient />
        <Script src="/src/apps/web/client.tsx" />
        <Link href="/src/apps/web/styles.css" rel="stylesheet" />

        {/* Set the theme before paint to avoid a light/dark flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||((!t||t==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`
          }}
        />
      </head>

      <body>
        <div id="root" />
      </body>
    </html>
  )
})

export default web
