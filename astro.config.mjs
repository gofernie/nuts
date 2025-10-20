// astro.config.mjs
console.log("ASTRO_DISABLE_WASM =", process.env.ASTRO_DISABLE_WASM);

import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import fs from 'node:fs';
import path from 'node:path';
import react from '@astrojs/react';          // ⬅️ add this

const keyPath  = 'certs/localhost-key.pem';
const certPath = 'certs/localhost.pem';
const hasCerts = fs.existsSync(keyPath) && fs.existsSync(certPath);

export default defineConfig({
  output: 'server',
  adapter: netlify({ devMiddleware: false }),

  // ⬅️ enable React islands
  integrations: [react()],

  server: hasCerts
    ? {
        host: true,
        https: {
          key: fs.readFileSync(path.resolve(keyPath)),
          cert: fs.readFileSync(path.resolve(certPath)),
        },
      }
    : { host: true },

  vite: { server: { strictPort: true } },
});
