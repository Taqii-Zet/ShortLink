import { redis } from '../lib/redis.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const raw = String(req.query.slugs || '').trim();
    if (!raw) return res.status(200).json({ links: [] });

    const slugs = [...new Set(raw.split(',').map(s => s.trim()).filter(Boolean))].slice(0, 200);
    if (!slugs.length) return res.status(200).json({ links: [] });

    const [entries, clicks] = await Promise.all([
      redis.mget(...slugs.map(s => `link:${s}`)),
      redis.mget(...slugs.map(s => `clicks:${s}`)),
    ]);

    const links = entries
      .map((e, i) => (e ? { ...e, clicks: Number(clicks[i]) || 0 } : null))
      .filter(Boolean);

    return res.status(200).json({ links });
  }

  if (req.method === 'DELETE') {
    const raw = String(req.query.slugs || req.query.slug || '').trim();
    if (!raw) return res.status(400).json({ error: 'slug(s) required' });

    const slugs = [...new Set(raw.split(',').map(s => s.trim()).filter(Boolean))];
    if (!slugs.length) return res.status(400).json({ error: 'slug(s) required' });

    await redis.del(...slugs.map(s => `link:${s}`), ...slugs.map(s => `clicks:${s}`));
    await Promise.all(slugs.map(s => redis.zrem('links:index', s)));

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}