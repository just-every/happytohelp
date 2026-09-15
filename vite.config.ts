import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({ plugins: [{
  name: 'connector-download-headers',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.split('?')[0] === '/downloads/happytohelp-local-agent.tar.gz') {
        // Vite treats .gz files as HTTP-compressed content. This is a gzip
        // download: preserve its bytes for the connector's tar -xzf command.
        res.setHeader('Content-Type', 'application/gzip')
        res.setHeader('Content-Encoding', 'identity')
      }
      next()
    })
  },
}, cloudflare({ configPath: process.env.H2H_WRANGLER_CONFIG, viteEnvironment: { name: 'ssr' } }), tanstackStart(), react()] })
