// astro.config.mjs
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import fs from 'node:fs';
import path from 'node:path';

const isDev = process.argv.includes('dev');    // true for `astro dev`
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
    // Fall back to HTTP if certs aren't present locally
    console.warn('[astro.config] HTTPS certs not found; falling back to HTTP for dev.');
  }
}

export default defineConfig({
  // You have server-rendered routes → keep SSR output
  output: 'server',

  // Use Netlify adapter for builds; no adapter in `astro dev`
  adapter: isDev ? undefined : netlify({ devMiddleware: false }),

  // Local dev server config (Netlify ignores this during CI/build)
  server: {
    host: true,
    port: 4321,
    https: httpsConfig,   // only defined in local dev when certs exist
  },

  // Also tell Vite to serve HTTPS only in local dev when certs exist
  vite: {
    server: { https: httpsConfig },
  },
});
