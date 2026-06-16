import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// Standalone config (no Cloudflare plugin) for fast unit tests of pure modules.
export default defineConfig({
  resolve: {
    alias: {
      "@api": r("./src/apps/api"),
      "@web": r("./src/apps/web"),
      "@bot": r("./src/apps/bot"),
      "@apps": r("./src/apps"),
      "@": r("./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
