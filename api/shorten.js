import { redis } from '../lib/redis.js';

const RESERVED = ['s', 'r', 'api', 'www', 'admin', 'app', 'login', 'signup', 'help'];
const SLUG_RE  = /^[a-zA-Z0-9_-]+$/;

const W = ['ace','arc','bay','bit','cave','cool','dawn','deep','echo','edge','fast','flow','fuel','gem','haze','hook','hub','isle','jade','keen','kite','lake','lane','leaf','link','loop','lush','maze','mesa','mint','mist','moon','moss','nest','node','oak','page','path','peak','pine','pipe','port','puma','quad','rail','reef','rise','road','rock','root','rust','sail','salt','sand','seed','skip','slim','slab','snap','soft','solo','span','star','stem','step','surf','swift','task','tide','tilt','trek','true','turf','twin','vine','void','wade','wave','wild','wire','wit','wolf','yard','yoke','zeal','zinc','zone'];

function randomSlug() {
  const a = W[Math.floor(Math.random() * W.length)];
  const b = W[Math.floor(Math.random() * W.length)];
  const n = Math.floor(Math.random() * 99) + 1;
  return `${a}-${b}-${n}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let { url, slug } = req.body || {};
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'URL is required' });

  url = url.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try { new URL(url); } catch { return res.status(400).json({ error: 'That doesn\'t look like a valid URL.' }); }

  if (slug) {
    slug = slug.trim();
    if (slug.length < 2)  return res.status(400).json({ error: 'At least 2 characters required.' });
    if (slug.length > 40) return res.status(400).json({ error: 'Maximum 40 characters.' });
    if (!SLUG_RE.test(slug)) return res.status(400).json({ error: 'Use letters, numbers, - or _ only.' });
    if (RESERVED.includes(slug.toLowerCase())) return res.status(400).json({ error: `"${slug}" is reserved.` });
    const exists = await redis.get(`link:${slug}`);
    if (exists) return res.status(409).json({ error: 'Already taken. Try another!' });
  } else {
    let attempt = randomSlug(), tries = 0;
    while (await redis.get(`link:${attempt}`) && tries++ < 20) attempt = randomSlug();
    slug = attempt;
  }

  const entry = { slug, original: url, createdAt: Date.now() };
  await redis.set(`link:${slug}`, entry);
  await redis.zadd('links:index', { score: entry.createdAt, member: slug });

  return res.status(200).json({ entry: { ...entry, clicks: 0 } });
}