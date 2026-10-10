import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { reproducibleOutput } from './scripts/delivery/reproducible-output.ts'
import { docsSite } from './src/ui/docs/build/plugin.ts'

export default defineConfig(({ command, isPreview }) => {
 const localOwnerLogin = command === 'serve' && !isPreview && process.env.H2H_LOCAL_OWNER_LOGIN === '1';
 return {
 define: { 'import.meta.env.H2H_LOCAL_OWNER_LOGIN': JSON.stringify(localOwnerLogin) },
 ...(localOwnerLogin ? { server: { host: '127.0.0.1', allowedHosts: ['localhost', '127.0.0.1', '[::1]'] } } : {}),
 plugins: [{
  name: 'connector-download-headers',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (process.env.H2H_INSTALLER_NONCE && req.url === '/__installer/identity') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ nonce: process.env.H2H_INSTALLER_NONCE }));
        return;
      }
      if (req.url?.split('?')[0] === '/downloads/happytohelp-local-agent.tar.gz') {
        // Vite treats .gz files as HTTP-compressed content. This is a gzip
        // download: preserve its bytes for the connector's tar -xzf command.
        res.setHeader('Content-Type', 'application/gzip')
        res.setHeader('Content-Encoding', 'identity')
      }
      next()
    })
  },
}, cloudflare({ ...(localOwnerLogin ? { remoteBindings: false } : {}), configPath: process.env.H2H_WRANGLER_CONFIG, viteEnvironment: { name: 'ssr' } }), docsSite(), tanstackStart(), react(), reproducibleOutput()] };
})
