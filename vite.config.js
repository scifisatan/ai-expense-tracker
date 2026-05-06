import { defineConfig } from 'vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import ssrPlugin from 'vite-ssr-components/plugin'
import { env } from 'process'

export default defineConfig({
  plugins: [cloudflare(), ssrPlugin()],
  server: {
    allowedHosts: true
  }
})