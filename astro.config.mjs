// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://fernie.realestate',
  redirects: { '/todo': '/todo/page/1' },
  server: { host: true, port: 4321, https: false },
  vite: { server: { host: true, port: 4321, https: false } },
});
