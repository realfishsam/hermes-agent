import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  css: { postcss: { plugins: [] } },
  build: {
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  resolve: {
    alias: [
      { find: '@/app', replacement: path.resolve(__dirname, 'src/hermes-app') },
      { find: '@hermes/shared', replacement: path.resolve(__dirname, 'src/mobile-shims/hermes-shared') },
      { find: '@', replacement: path.resolve(__dirname, 'src') }
    ],
    dedupe: ['react', 'react-dom']
  },
  server: { host: '0.0.0.0', port: 5174, strictPort: true }
});
