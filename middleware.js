import { redis } from './lib/redis.js';

export const config = {
  matcher: '/((?!api/|_next/|favicon.ico|logo.png|style.css|app.js).*)',
};

export default async function middleware(request, event) {
  const { pathname } = new URL(request.url);
  const slug = decodeURIComponent(pathname.slice(1)).replace(/\/$/, '');
  if (!slug) return; // root path, biarin landing page tampil normal

  const entry = await redis.get(`link:${slug}`);
  if (!entry || !entry.original) return; // slug gak ketemu, fallback ke landing page

  event.waitUntil(redis.incr(`clicks:${slug}`));

  return Response.redirect(entry.original, 307);
}