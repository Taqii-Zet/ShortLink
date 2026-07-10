import { redis } from './lib/redis.js';

export const config = {
  matcher: '/((?!api/|_next/|favicon.ico|logo.png|style.css|app.js).*)',
};

// Social media / messaging apps yang bikin link preview — biarin mereka
// lihat halaman ShortLink sendiri, bukan ikut ke-redirect ke tujuan.
const BOT_UA = /facebookexternalhit|Facebot|Instagram|Twitterbot|Slackbot|TelegramBot|WhatsApp|LinkedInBot|Discordbot|SkypeUriPreview|Pinterest|redditbot|Applebot|vkShare|Iframely|Embedly|W3C_Validator|Google-InspectionTool/i;

export default async function middleware(request, event) {
  const { pathname } = new URL(request.url);
  const slug = decodeURIComponent(pathname.slice(1)).replace(/\/$/, '');
  if (!slug) return;

  const ua = request.headers.get('user-agent') || '';
  if (BOT_UA.test(ua)) return; // bot preview → tampilkan index.html apa adanya

  const entry = await redis.get(`link:${slug}`);
  if (!entry || !entry.original) return;

  if (entry.passwordHash) {
    const unlockUrl = new URL('/unlock.html', request.url);
    unlockUrl.searchParams.set('slug', slug);
    return Response.redirect(unlockUrl, 307);
  }

  event.waitUntil(redis.incr(`clicks:${slug}`));

  return Response.redirect(entry.original, 307);
}