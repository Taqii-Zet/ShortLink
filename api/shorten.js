import { redis } from '../lib/redis.js';
import { hashPassword } from '../lib/hash.js';

const RESERVED = ['s', 'r', 'api', 'www', 'admin', 'app', 'login', 'signup', 'help'];
const SLUG_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SLUG_LEN   = 5;

function randomSlug() {
  let s = '';
  for (let i = 0; i < SLUG_LEN; i++) {
    s += SLUG_CHARS[Math.floor(Math.random() * SLUG_CHARS.length)];
  }
  return s;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let { url, slug, expiresAt: rawExpiresAt, password } = req.body || {};
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'URL is required' });

  url = url.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try { new URL(url); } catch { return res.status(400).json({ error: "That doesn't look like a valid URL." }); }

  if (slug) {
    slug = slug.trim();
    if (slug.length < 2)  return res.status(400).json({ error: 'At least 2 characters required.' });
    if (slug.length > 40) return res.status(400).json({ error: 'Maximum 40 characters.' });
    if (!/^[a-zA-Z0-9_-]+$/.test(slug)) return res.status(400).json({ error: 'Use letters, numbers, - or _ only.' });
    if (RESERVED.includes(slug.toLowerCase())) return res.status(400).json({ error: `"${slug}" is reserved.` });
    const exists = await redis.get(`link:${slug}`);
    if (exists) return res.status(409).json({ error: 'Already taken. Try another!' });
  } else {
    let attempt = randomSlug(), tries = 0;
    while (await redis.get(`link:${attempt}`) && tries++ < 20) attempt = randomSlug();
    slug = attempt;
  }

  let expiresAt  = null;
  let ttlSeconds = null;

  if (rawExpiresAt) {
    const ts = Number(rawExpiresAt);
    if (!Number.isFinite(ts) || ts <= Date.now()) {
      return res.status(400).json({ error: 'Expiration date must be in the future.' });
    }
    expiresAt  = ts;
    ttlSeconds = Math.ceil((ts - Date.now()) / 1000);
  }

  let passwordHash = null;
  let passwordSalt = null;
  if (password && typeof password === 'string' && password.trim()) {
    if (password.trim().length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters.' });
    }
    const hashed = hashPassword(password.trim());
    passwordHash = hashed.hash;
    passwordSalt = hashed.salt;
  }

  const entry = {
    slug,
    original: url,
    createdAt: Date.now(),
    expiresAt,
    passwordHash,
    passwordSalt,
  };

  if (ttlSeconds) {
    await redis.set(`link:${slug}`, entry, { ex: ttlSeconds });
    await redis.set(`clicks:${slug}`, 0, { ex: ttlSeconds });
  } else {
    await redis.set(`link:${slug}`, entry);
  }
  await redis.zadd('links:index', { score: entry.createdAt, member: slug });

  const { passwordHash: _ph, passwordSalt: _ps, ...publicEntry } = entry;
  return res.status(200).json({ entry: { ...publicEntry, clicks: 0, protected: !!passwordHash } });
}