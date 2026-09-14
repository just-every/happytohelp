import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({ plugins: [cloudflare({ configPath: process.env.H2H_WRANGLER_CONFIG, viteEnvironment: { name: 'ssr' } }), tanstackStart(), react()] })
