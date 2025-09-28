// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // 👇 Add your production site URL here (important for SEO)
  site: 'https://fernie.realestate',

  // 👇 You can add integrations like Tailwind or Sitemap later if needed
  // integrations: [],

  // 👇 This is the instant redirect: /todo → /todo/page/1
  redirects: {
    '/todo': '/todo/page/1',
  },
});
