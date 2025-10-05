// @ts-check
import { defineConfig } from 'astro/config';
import fs from 'node:fs';

export default defineConfig({
  site: 'https://fernie.realestate',
  redirects: { '/todo': '/todo/page/1' },

  server: {
    https: {
      key:  fs.readFileSync('.cert/localhost-key.pem'),
      cert: fs.readFileSync('.cert/localhost.pem'),
    },
    host: 'localhost',
    port: 4321,
  },
  vite: {
    server: {
      https: {
        key:  fs.readFileSync('.cert/localhost-key.pem'),
        cert: fs.readFileSync('.cert/localhost.pem'),
      },
      host: 'localhost',
      port: 4321,
    },
  },
});
