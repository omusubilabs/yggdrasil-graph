// @ts-check
import { defineConfig } from 'astro/config';

// Yggdrasil Graph is a fully static site served by Cloudflare Workers Static
// Assets. There is deliberately no adapter and no server output: every route
// prerenders to HTML at build time. See CLAUDE.md, "hard constraints".
export default defineConfig({
  // Canonical origin for canonical URLs and hreflang alternates.
  site: 'https://yggdrasil-graph.omusubilabs.fi',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
    // Inline nothing implicitly; we want the graph runtime to stay a separate,
    // lazily fetched chunk so the initial route keeps its JS budget.
    inlineStylesheets: 'auto',
  },
  i18n: {
    defaultLocale: 'en',
    // Post-v1 targets are declared here from day one so routing, hreflang and
    // the i18n checker all agree on the same list. Only `en` (complete) and
    // `ja` (partial stub) have locale files in this commit.
    locales: ['en', 'ja', 'is', 'nb', 'sv', 'da', 'fi'],
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },
  vite: {
    build: {
      // Keep the d3 submodules in their own chunk, split from page code.
      chunkSizeWarningLimit: 200,
    },
  },
});
