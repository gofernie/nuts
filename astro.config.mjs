// astro.config.mjs
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import path from 'node:path';

const isDev = process.argv.includes('dev');
const isCI  = !!process.env.CI || !!process.env.NETLIFY;

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
  site: 'https://fernie.homes',

  // Keep SSR for routes that need it
  output: 'server',

  // Use Netlify adapter only in CI/prod
  adapter: isDev ? undefined : netlify({ devMiddleware: false }),

  // ✅ NEW: prerender just the homepage so it’s CDN-cached and avoids cold starts
  prerender: {
    routes: ['/', '/index'],   // ensure the root gets built as static HTML
    crawl: true,               // still statically discover other safe pages
  },

  integrations: [
    sitemap({ changefreq: 'weekly' }),
  ],

  server: {
    host: true,
    port: 4321,
    https: httpsConfig,
  },

  vite: {
    server: { https: httpsConfig },
  },
});
