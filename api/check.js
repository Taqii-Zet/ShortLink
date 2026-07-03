import { redis } from '../lib/redis.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const slug = String(req.query.slug || '').trim();
  if (!slug) return res.status(200).json({ available: true });

  const RESERVED = ['s', 'r', 'api', 'www', 'admin', 'app', 'login', 'signup', 'help'];
  const SLUG_RE  = /^[a-zA-Z0-9_-]+$/;

  if (slug.length < 2)  return res.status(200).json({ available: false, reason: 'At least 2 characters required.' });
  if (slug.length > 40) return res.status(200).json({ available: false, reason: 'Maximum 40 characters.' });
  if (!SLUG_RE.test(slug)) return res.status(200).json({ available: false, reason: 'Use letters, numbers, - or _ only.' });
  if (RESERVED.includes(slug.toLowerCase())) return res.status(200).json({ available: false, reason: `"${slug}" is reserved.` });

  const exists = await redis.get(`link:${slug}`);
  return res.status(200).json(
    exists ? { available: false, reason: 'Already taken. Try another!' } : { available: true, reason: "Awesome! It's available." }
  );
}