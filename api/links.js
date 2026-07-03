import { redis } from '../lib/redis.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const slugs = await redis.zrange('links:index', 0, -1, { rev: true });
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
    const { slug, all } = req.query;

    if (all === 'true') {
      const slugs = await redis.zrange('links:index', 0, -1);
      if (slugs.length) {
        await redis.del(...slugs.map(s => `link:${s}`), ...slugs.map(s => `clicks:${s}`));
        await redis.del('links:index');
      }
      return res.status(200).json({ ok: true });
    }

    if (!slug) return res.status(400).json({ error: 'slug is required' });
    await redis.del(`link:${slug}`, `clicks:${slug}`);
    await redis.zrem('links:index', slug);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}