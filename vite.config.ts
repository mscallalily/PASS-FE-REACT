import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'PASS_');
  const target = process.env.PASS_API_PROXY_TARGET || env.PASS_API_PROXY_TARGET || 'http://127.0.0.1:8000';
  if (!/^https?:\/\//i.test(target)) throw new Error('PASS_API_PROXY_TARGET must be an HTTP or HTTPS URL.');
  const port = Number(process.env.PORT || 8444);
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
    build: { sourcemap: false },
    server: { host: '0.0.0.0', port, strictPort: true, proxy: { '/api': { target, changeOrigin: true } } },
    preview: { host: '0.0.0.0', port, strictPort: true, proxy: { '/api': { target, changeOrigin: true } } },
  };
});
