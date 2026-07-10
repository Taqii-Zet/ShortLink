import { redis } from '../lib/redis.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const slug = String(req.query.slug || '').trim();
  if (!slug) return res.status(200).json({ found: false });

  const entry = await redis.get(`link:${slug}`);
  if (!entry || !entry.original) return res.status(200).json({ found: false });

  return res.status(200).json({ found: true, protected: !!entry.passwordHash });
}