// astro.config.mjs
console.log("→ Starting Astro with HTTPS…");

import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import fs from 'node:fs';
import path from 'node:path';

// Detect whether we're in `astro dev` or `astro build`
const isDev = process.argv.some(arg => arg === 'dev');

// --- HTTPS Cert Paths ---
const keyPath  = path.resolve('certs/localhost-key.pem');
const certPath = path.resolve('certs/localhost.pem');

function read(file) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `⚠️ HTTPS cert missing: ${file}\n` +
      `   Run:\n` +
      `     mkcert -install\n` +
      `     mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem "localhost" 127.0.0.1 ::1\n`
    );
  }
  return fs.readFileSync(file);
}

console.log(`• Using key:  ${keyPath}  (${fs.existsSync(keyPath) ? 'found' : 'MISSING'})`);
console.log(`• Using cert: ${certPath}  (${fs.existsSync(certPath) ? 'found' : 'MISSING'})`);

export default defineConfig({
  output: 'server',

  // Only apply adapter in build (removes Netlify dev middleware during local dev)
  adapter: isDev ? undefined : netlify({ devMiddleware: false }),

  server: {
    host: true,
    port: 4321,
    https: {
      key:  read(keyPath),
      cert: read(certPath),
    },
  },

  vite: {
    server: {
      https: {
        key:  read(keyPath),
        cert: read(certPath),
      },
    },
  },
});
