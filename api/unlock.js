import { redis } from '../lib/redis.js';
import { verifyPassword } from '../lib/hash.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { slug, password } = req.body || {};
  if (!slug) return res.status(400).json({ error: 'slug is required' });

  const entry = await redis.get(`link:${slug}`);
  if (!entry || !entry.original) return res.status(404).json({ error: 'Link not found.' });

  if (!entry.passwordHash) {
    await redis.incr(`clicks:${slug}`);
    return res.status(200).json({ url: entry.original });
  }

  if (!password || !verifyPassword(String(password), entry.passwordSalt, entry.passwordHash)) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  await redis.incr(`clicks:${slug}`);
  return res.status(200).json({ url: entry.original });
}