// astro.config.mjs
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import fs from 'node:fs';
import path from 'node:path';

const isDev = process.argv.includes('dev');         // true only for `astro dev`
const isCI  = !!process.env.CI || !!process.env.NETLIFY;

// Only use HTTPS locally (not in CI)
const useHttps = isDev && !isCI;

let httpsConfig = undefined;
if (useHttps) {
  const keyPath  = path.resolve('certs/localhost-key.pem');
  const certPath = path.resolve('certs/localhost.pem');
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    httpsConfig = {
      key:  fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
  } else {
    console.warn('[astro.config] HTTPS certs not found; falling back to HTTP for dev.');
  }
}

export default defineConfig({
  // You have SSR routes
  output: 'server',

  // ✅ Do NOT load adapter in dev (prevents Netlify dev middleware)
  // ✅ Load adapter for production builds / CI
  adapter: isDev ? undefined : netlify({ devMiddleware: false }),

  // Local dev server
  server: {
    host: true,
    port: 4321,
    https: httpsConfig,
  },

  // Vite dev server HTTPS
  vite: {
    server: { https: httpsConfig },
  },
});
