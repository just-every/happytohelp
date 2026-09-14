import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
await build({root, configFile: false, publicDir: false, plugins: [react()], define: {'process.env.NODE_ENV': JSON.stringify('production')}, build: {outDir: 'public', emptyOutDir: false, lib: {entry: 'src/modules/widget/embed.jsx', name: 'HappyToHelpWidget', formats: ['iife'], fileName: () => 'widget.js'}}});
