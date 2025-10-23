// astro.config.mjs
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import path from 'node:path';

const isDev = process.argv.includes('dev');
const isCI  = !!process.env.CI || !!process.env.NETLIFY;

// Optional HTTPS for local dev
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

  // ✅ switched from SSR to fully static
  output: 'static',

  // Netlify adapter is optional, but fine to keep for static hosting
  adapter: netlify(),

  // No need for prerender routes — the entire site is prerendered automatically
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
