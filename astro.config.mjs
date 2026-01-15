import { defineConfig } from "astro/config";
import netlify from "@astrojs/netlify";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://fernie.homes",

  output: "server",
  adapter: netlify(),

  integrations: [sitemap()],
});
