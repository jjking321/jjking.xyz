// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import vercel from '@astrojs/vercel/serverless';

// Hybrid output: pages are static by default, but routes that opt-in with
// `export const prerender = false;` run as serverless functions. The admin
// dashboard and its API routes need that — everything else stays prerendered.
export default defineConfig({
  site: 'https://jjking.xyz',
  output: 'hybrid',
  adapter: vercel({
    // 4.5 MB is Vercel's hobby-tier function body limit. Image upload
    // endpoints stay under it by compressing in-browser before POST.
    maxDuration: 30,
  }),
  integrations: [mdx()],
  image: {
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
