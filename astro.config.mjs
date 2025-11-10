// astro.config.mjs
import { defineConfig } from "astro/config";
import netlify from "@astrojs/netlify";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://fernie.homes",
  // "server" = full SSR; "hybrid" = mostly static with SSR where needed.
  output: "server",
  adapter: netlify({
    // edge: true,            // optional
    // functionPerRoute: true // optional
  }),
  integrations: [sitemap()],
});
