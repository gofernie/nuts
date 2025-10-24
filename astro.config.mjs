// astro.config.mjs
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import path from 'node:path';

const isDev = process.argv.includes('dev');
const isCI  = !!process.env.CI || !!process.env.NETLIFY;

// Dev-only HTTPS using mkcert certs in ./certs
function devHttpsConfig() {
  if (!isDev || isCI) return undefined; // never use HTTPS in CI/Netlify build
  const keyPath  = path.resolve('certs/localhost-key.pem');
  const certPath = path.resolve('certs/localhost.pem');
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  }
  console.warn('[astro.config] Dev HTTPS certs not found; using HTTP on port 4321.');
  return undefined;
}

export default defineConfig({
  site: 'https://fernie.homes',
  output: 'static',                              // fully static for local stability
  adapter: netlify({ devMiddleware: false }),    // disable Netlify dev emulation
  integrations: [sitemap()],                     // keep if you use @astrojs/sitemap
  server: {
    host: true,
    port: 4321,
    https: devHttpsConfig(),                     // enables HTTPS in dev when certs exist
  },
});
