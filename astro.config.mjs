// astro.config.mjs
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import fs from 'node:fs';
import path from 'node:path';

const keyPath  = 'certs/localhost-key.pem';
const certPath = 'certs/localhost.pem';
const hasCerts = fs.existsSync(keyPath) && fs.existsSync(certPath);

export default defineConfig({
  // you’re using prerender=false somewhere → keep SSR output
  output: 'server',
  // 🔕 turn off Netlify dev emulation to avoid the undici error
  adapter: netlify({ devMiddleware: false }),

  // 🔐 serve HTTPS in dev with your mkcert certs
  server: hasCerts
    ? {
        host: true,
        https: {
          key: fs.readFileSync(path.resolve(keyPath)),
          cert: fs.readFileSync(path.resolve(certPath)),
        },
      }
    : { host: true },

  // optional: hold the port
  vite: { server: { strictPort: true } },
});
