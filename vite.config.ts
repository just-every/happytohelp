import { rm } from "node:fs/promises";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({
  plugins: [
    cloudflare({
      configPath: process.env.H2H_WRANGLER_CONFIG,
      persistState: process.env.H2H_PERSIST_PATH
        ? { path: process.env.H2H_PERSIST_PATH }
        : true,
      viteEnvironment: { name: "ssr" },
    }),
    tanstackStart({ prerender: { enabled: false } }),
    react(),
    {
      name: "remove-build-secrets",
      apply: "build",
      enforce: "post",
      async closeBundle() {
        await rm("dist/server/.dev.vars", { force: true });
      },
    },
  ],
});
