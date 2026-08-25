// @ts-check

import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import astroExpressiveCode from "astro-expressive-code";
import { defineConfig } from "astro/config";
import { env } from "node:process";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: env.SITE_URL || "https://tech-b.munusshih.com",
  integrations: [astroExpressiveCode(), mdx(), sitemap()],
  vite: {
    resolve: {
      alias: {
        "@": "/src",
      },
    },

    plugins: [tailwindcss()],
  },
});
