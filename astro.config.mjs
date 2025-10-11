// astro.config.mjs
import { defineConfig } from 'astro/config';
import fs from 'fs';
import path from 'path';

function pick(...candidates) {
  for (const f of candidates) {
    const p = path.resolve(f);
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`[astro.config] TLS files not found. Looked for: ${candidates.join(', ')}`);
}

const certPath = pick('./localhost.pem', './localhost+2.pem');
const keyPath  = pick('./localhost-key.pem', './localhost+2-key.pem');

export default defineConfig({
  // Astro's own dev server settings
  server: {
    host: 'localhost',
    port: 4321,
  },

  // Use Vite's HTTPS (this is what actually does the TLS)
  vite: {
    server: {
      https: {
        cert: fs.readFileSync(certPath),
        key:  fs.readFileSync(keyPath),
      },
    },
  },
});
