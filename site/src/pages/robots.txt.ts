import type { APIRoute } from 'astro';
import { SITE_URL } from '../config.js';

// robots.txt needs an absolute sitemap URL, so it is generated from SITE_URL at build time.
export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap-index.xml', SITE_URL).toString()}\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
