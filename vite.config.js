import { defineConfig } from "vitest/config";
import { cloudflare } from "@cloudflare/vite-plugin";
import ssrPlugin from "vite-ssr-components/plugin";

export default defineConfig({
  plugins: [cloudflare(), ssrPlugin()],
  server: {
    allowedHosts: true,
    port: "3001"
  },
  test: {
    environment: "node",
  },
});
