import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { archiveOutputGuard } from '@runeditrun/rer/archive-output'
import { reproducibleOutput } from './scripts/delivery/reproducible-output.ts'
import { docsSite } from './src/ui/docs/build/plugin.ts'
import {widgetDevAsset} from './scripts/widget-dev-asset'

export default defineConfig(({ command, isPreview }) => {
 const localOrigin = command === 'serve' && !isPreview ? process.env.RER_DEV_ORIGIN : undefined;
 if(localOrigin && (!/^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):[0-9]+$/.test(localOrigin)))throw Error('Unsafe local development origin');
 return {
 define: { 'import.meta.env.RER_LOCAL_ORIGIN': JSON.stringify(localOrigin) },
 server: {
  host: '127.0.0.1', allowedHosts: ['localhost', '127.0.0.1', '[::1]'],
  fs: {
   allow: ['src', 'public', 'node_modules', 'package.json', 'local-agent/lib/provider-error.mjs'],
   deny: ['**/.rer/**', '**/.seed/**', '**/exports/**', '**/*.rer'],
  },
 },
 plugins: [widgetDevAsset(localOrigin),{
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
}, cloudflare({ ...(localOrigin?{config:{main:'src/dev/server.ts',vars:{RER_DEV_KEY:process.env.RER_DEV_KEY||'',RER_DEV_IDENTITY:process.env.RER_DEV_IDENTITY||'on'}}}:{}), remoteBindings: false, configPath: process.env.H2H_WRANGLER_CONFIG, viteEnvironment: { name: 'ssr' } }), docsSite(), tanstackStart(), react(), reproducibleOutput(), archiveOutputGuard()] };
})
