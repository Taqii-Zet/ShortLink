/* =====================================================
   ShortLink — App Logic
   Storage: localStorage
   Redirect: ?s=<slug> query param
   Domain: https://taqii-zet.github.io/ShortLink
   ===================================================== */

'use strict';

/* ── CONFIG ─────────────────────────────────────────── */
const CFG = {
  baseUrl:    'https://taqii-zet.github.io/ShortLink',
  displayBase: 'taqii-zet.github.io/ShortLink',
  storageKey: 'taqi_links',
  reserved:   ['s','r','api','www','admin','app','login','signup','help'],
};

function buildShortUrl(slug)   { return `${CFG.baseUrl}/?s=${encodeURIComponent(slug)}`; }
function buildDisplayUrl(slug) { return `${CFG.displayBase}/?s=${slug}`; }

/* ── STORAGE ─────────────────────────────────────────── */
function getLinks() {
  try { return JSON.parse(localStorage.getItem(CFG.storageKey)) || {}; }
  catch { return {}; }
}
function saveLinks(map) { localStorage.setItem(CFG.storageKey, JSON.stringify(map)); }

function addLink(slug, original) {
  const map   = getLinks();
  const entry = { slug, original, short: buildShortUrl(slug), display: buildDisplayUrl(slug), createdAt: Date.now(), clicks: 0 };
  map[slug]   = entry;
  saveLinks(map);
  return entry;
}
function removeLink(slug) { const m = getLinks(); delete m[slug]; saveLinks(m); }
function nukeLinks()      { localStorage.removeItem(CFG.storageKey); }
function bumpClick(slug)  {
  const m = getLinks();
  if (m[slug]) { m[slug].clicks = (m[slug].clicks || 0) + 1; saveLinks(m); }
}

/* ── REDIRECT ───────────────────────────────────────── */
(function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const slug   = params.get('s');
  if (!slug) return;

  const entry = getLinks()[slug];
  if (!entry) {
    // Bad slug — clean URL and stay on page
    history.replaceState({}, '', window.location.pathname);
    return;
  }

  bumpClick(slug);

  // Show overlay
  const overlay = document.getElementById('redirect-overlay');
  const dest    = document.getElementById('redir-dest');
  const manual  = document.getElementById('redir-manual');
  overlay.style.display = 'flex';
  try { dest.textContent = new URL(entry.original).hostname; }
  catch { dest.textContent = entry.original.slice(0, 50); }
  manual.href = entry.original;

  setTimeout(() => { window.location.href = entry.original; }, 2000);
})();

/* ── SLUG VALIDATION ─────────────────────────────────── */
const SLUG_RE = /^[a-zA-Z0-9_-]+$/;

function validateSlug(slug) {
  if (!slug) return { ok: true };
  if (slug.length < 2)                   return { ok: false, msg: 'At least 2 characters required.' };
  if (slug.length > 40)                  return { ok: false, msg: 'Maximum 40 characters.' };
  if (!SLUG_RE.test(slug))               return { ok: false, msg: 'Use letters, numbers, - or _ only.' };
  if (CFG.reserved.includes(slug.toLowerCase())) return { ok: false, msg: `"${slug}" is reserved.` };
  if (getLinks()[slug])                  return { ok: false, msg: 'Already taken. Try another!' };
  return { ok: true, msg: '✓ Available' };
}

/* ── WORD LIST (for random slugs) ────────────────────── */
const W = [
  'ace','arc','bay','bit','cave','cool','dawn','deep','echo','edge',
  'fast','flow','fuel','gem','haze','hook','hub','isle','jade','keen',
  'kite','lake','lane','leaf','link','loop','lush','maze','mesa','mint',
  'mist','moon','moss','nest','node','oak','page','path','peak','pine',
  'pipe','port','puma','quad','rail','reef','rise','road','rock','root',
  'rust','sail','salt','sand','seed','skip','slim','slab','snap','soft',
  'solo','span','star','stem','step','surf','swift','task','tide','tilt',
  'trek','true','turf','twin','vine','void','wade','wave','wild','wire',
  'wit','wolf','yard','yoke','zeal','zinc','zone',
];

function rndSlug() {
  const a = W[Math.floor(Math.random() * W.length)];
  const b = W[Math.floor(Math.random() * W.length)];
  const n = Math.floor(Math.random() * 99) + 1;
  return `${a}-${b}-${n}`;
}

/* ── SCRAMBLE ANIMATION ─────────────────────────────── */
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_./?=';

function scrambleReveal(el, finalText, duration = 900) {
  const totalFrames = Math.ceil(duration / 40);
  let frame = 0;

  const tick = setInterval(() => {
    frame++;
    const progress  = frame / totalFrames;
    const revealed  = Math.floor(progress * finalText.length);
    let out = finalText.slice(0, revealed);
    const noise = Math.min(finalText.length - revealed, 5);
    for (let i = 0; i < noise; i++) {
      out += CHARS[Math.floor(Math.random() * CHARS.length)];
    }
    el.textContent = out;
    if (frame >= totalFrames) { clearInterval(tick); el.textContent = finalText; }
  }, 40);
}

/* ── LIVE PREVIEW ───────────────────────────────────── */
function updatePreview() {
  const slug = document.getElementById('custom-slug').value.trim();
  const el   = document.getElementById('lp-slug');
  el.textContent = slug || 'my-link';
}

/* ── CORE: SHORTEN ──────────────────────────────────── */
let lastEntry = null;

function shortenURL() {
  const urlEl   = document.getElementById('long-url');
  const slugEl  = document.getElementById('custom-slug');
  const btn     = document.getElementById('shorten-btn');

  let rawUrl = urlEl.value.trim();
  let slug   = slugEl.value.trim();

  // ── Validate URL
  if (!rawUrl) {
    urlEl.classList.add('err'); shake(urlEl.parentElement);
    showToast('error', 'Please enter a URL.');
    setTimeout(() => urlEl.classList.remove('err'), 1400);
    return;
  }
  if (!/^https?:\/\//i.test(rawUrl)) rawUrl = 'https://' + rawUrl;
  try { new URL(rawUrl); }
  catch {
    urlEl.classList.add('err'); shake(urlEl.parentElement);
    showToast('error', 'That doesn\'t look like a valid URL.');
    setTimeout(() => urlEl.classList.remove('err'), 1400);
    return;
  }

  // ── Validate slug
  if (slug) {
    const v = validateSlug(slug);
    if (!v.ok) { showToast('error', v.msg); return; }
  } else {
    // Auto-generate unique slug
    let attempt = rndSlug();
    let tries   = 0;
    while (getLinks()[attempt] && tries++ < 20) attempt = rndSlug();
    slug = attempt;
  }

  // ── Animate button
  btn.disabled = true;
  document.getElementById('btn-label').textContent = 'Cutting…';

  // ── Animate the cut-line on the preview strip
  const lp = document.getElementById('live-preview');
  lp.classList.add('cutting');
  setTimeout(() => lp.classList.remove('cutting'), 600);

  // ── After brief delay, create link & show result
  setTimeout(() => {
    const entry = addLink(slug, rawUrl);
    lastEntry   = entry;

    btn.disabled = false;
    document.getElementById('btn-label').textContent = 'Shorten URL';

    showResult(entry);
    updateStats();
    renderHistory();
    showToast('ok', 'Short link created!');
  }, 660);
}

function showResult(entry) {
  const wrap = document.getElementById('result-wrap');
  const linkEl = document.getElementById('result-link');
  const origEl = document.getElementById('result-orig');
  const cpBtn  = document.getElementById('copy-btn');

  // Prep display
  linkEl.href = entry.short;
  try { origEl.textContent = '→ ' + new URL(entry.original).hostname + '/...'; }
  catch { origEl.textContent = '→ ' + entry.original.slice(0, 60); }

  // Reset copy button
  cpBtn.classList.remove('copied');
  cpBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Copy</span>`;

  // Show container
  wrap.style.display = 'block';

  // Scramble the link text
  linkEl.textContent = '';
  scrambleReveal(linkEl, entry.display, 800);
}

function copyResult() {
  if (!lastEntry) return;
  copyText(lastEntry.short);
  const btn = document.getElementById('copy-btn');
  btn.classList.add('copied');
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span>Copied!</span>`;
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Copy</span>`;
  }, 2200);
}

function shortenAnother() {
  document.getElementById('long-url').value   = '';
  document.getElementById('custom-slug').value = '';
  document.getElementById('result-wrap').style.display = 'none';
  document.getElementById('slug-status').textContent = '';
  document.getElementById('slug-status').className   = 'slug-status';
  document.getElementById('clear-btn').style.display = 'none';
  document.getElementById('lp-slug').textContent = 'my-link';
  lastEntry = null;
  document.getElementById('long-url').focus();
}

function clearURL() {
  document.getElementById('long-url').value = '';
  document.getElementById('clear-btn').style.display = 'none';
  document.getElementById('long-url').focus();
}

/* ── RANDOM SLUG ─────────────────────────────────────── */
function generateRandom() {
  let s = rndSlug();
  let t = 0;
  while (getLinks()[s] && t++ < 20) s = rndSlug();
  document.getElementById('custom-slug').value = s;
  updatePreview();
  validateSlugInput();

  // Spin the dice icon
  const btn = document.getElementById('dice-btn');
  btn.style.transition = 'transform 0.3s ease';
  btn.style.transform  = 'rotate(180deg)';
  setTimeout(() => { btn.style.transform = 'rotate(360deg)'; }, 200);
  setTimeout(() => { btn.style.transform = ''; btn.style.transition = ''; }, 400);
}

/* ── HISTORY ─────────────────────────────────────────── */
function renderHistory(filter = '') {
  const links   = getLinks();
  const entries = Object.values(links).sort((a, b) => b.createdAt - a.createdAt);
  const list    = document.getElementById('history-list');
  const empty   = document.getElementById('history-empty');
  const caBtn   = document.getElementById('clear-all-btn');

  if (entries.length === 0) {
    list.innerHTML = '';
    empty.style.display  = 'flex';
    caBtn.style.display  = 'none';
    return;
  }

  empty.style.display = 'none';
  caBtn.style.display = 'inline-flex';

  const filtered = filter
    ? entries.filter(e => e.slug.includes(filter) || e.original.toLowerCase().includes(filter))
    : entries;

  if (filtered.length === 0) {
    list.innerHTML = `<div style="padding:40px;text-align:center;color:var(--faint);font-size:.84rem">No results for "${esc(filter)}"</div>`;
    return;
  }

  list.innerHTML = filtered.map(e => {
    let initials = '??';
    try { initials = new URL(e.original).hostname.replace('www.', '').slice(0, 2).toUpperCase(); } catch {}
    const clicks = e.clicks || 0;
    return `
    <div class="hist-item" id="hi-${e.slug}">
      <div class="hist-initials">${initials}</div>
      <div class="hist-info">
        <div class="hist-short-row">
          <a class="hist-link" href="${esc(e.short)}" target="_blank" rel="noopener">${esc(e.display)}</a>
          <span class="hist-clicks">${clicks} click${clicks !== 1 ? 's' : ''}</span>
        </div>
        <div class="hist-orig" title="${esc(e.original)}">${esc(e.original)}</div>
      </div>
      <span class="hist-date">${ago(e.createdAt)}</span>
      <div class="hist-actions">
        <button class="hbtn" title="Copy" onclick="copyHistItem('${esc(e.slug)}','${esc(e.short)}',this)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button class="hbtn del" title="Delete" onclick="askDelete('${esc(e.slug)}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

function filterHistory() {
  const q = document.getElementById('history-search').value.trim().toLowerCase();
  renderHistory(q);
}

/* ── STATS ───────────────────────────────────────────── */
function updateStats() {
  const entries = Object.values(getLinks());
  tickNum(document.getElementById('stat-total'),  entries.length);
  tickNum(document.getElementById('stat-clicks'), entries.reduce((s, e) => s + (e.clicks || 0), 0));
}

function tickNum(el, target) {
  if (!el) return;
  const from  = parseInt(el.textContent) || 0;
  if (from === target) return;
  const delta = target - from;
  const steps = Math.min(Math.abs(delta), 15);
  let cur = from, i = 0;
  const t = setInterval(() => {
    i++;
    cur += delta / steps;
    el.textContent = Math.round(i < steps ? cur : target);
    if (i >= steps) clearInterval(t);
  }, 25);
}

/* ── DELETE MODAL ────────────────────────────────────── */
let _pendingSlug = null;

function askDelete(slug) {
  _pendingSlug = slug;
  document.getElementById('modal-title').textContent = 'Delete this link?';
  document.getElementById('modal-msg').textContent   = `taqii-zet.github.io/ShortLink/?s=${slug} will be permanently removed.`;
  document.getElementById('modal-confirm').onclick   = doDelete;
  document.getElementById('modal-bg').style.display  = 'flex';
}

function doDelete() {
  if (_pendingSlug) { removeLink(_pendingSlug); _pendingSlug = null; }
  closeModal();
  renderHistory();
  updateStats();
  showToast('ok', 'Link deleted.');
}

function clearAllLinks() {
  document.getElementById('modal-title').textContent = 'Clear all links?';
  document.getElementById('modal-msg').textContent   = 'All saved links will be permanently deleted.';
  document.getElementById('modal-confirm').onclick   = () => {
    nukeLinks();
    closeModal();
    renderHistory();
    updateStats();
    showToast('ok', 'All links cleared.');
  };
  document.getElementById('modal-bg').style.display = 'flex';
}

function closeModal() { document.getElementById('modal-bg').style.display = 'none'; }
function handleModalBgClick(e) { if (e.target.id === 'modal-bg') closeModal(); }

/* ── COPY ────────────────────────────────────────────── */
function copyText(str) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(str).catch(() => fallback(str));
  } else { fallback(str); }
}

function fallback(str) {
  const ta = document.createElement('textarea');
  ta.value = str; ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta); ta.focus(); ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

function copyHistItem(slug, short, btn) {
  copyText(short);
  showToast('ok', 'Copied!');
  const orig = btn.innerHTML;
  btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
  btn.classList.add('copied-flash');
  setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('copied-flash'); }, 1600);
}

/* ── TOAST ───────────────────────────────────────────── */
function showToast(type, msg) {
  const stack = document.getElementById('toast-stack');
  const icons = {
    ok:  `<svg class="toast-ok"  width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:`<svg class="toast-err" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  };
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `${icons[type] || ''}<span>${esc(msg)}</span>`;
  stack.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 220); }, 2400);
}

/* ── HELPERS ─────────────────────────────────────────── */
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function ago(ts) {
  const d = Date.now() - ts;
  if (d < 60e3)  return 'just now';
  if (d < 3.6e6) return `${Math.floor(d/60e3)}m ago`;
  if (d < 864e5) return `${Math.floor(d/3.6e6)}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

function shake(el) {
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = 'shake 0.4s ease';
  setTimeout(() => { el.style.animation = ''; }, 400);
}

function scrollToShorten() {
  document.getElementById('shorten-section').scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => document.getElementById('long-url').focus(), 600);
}

/* ── SLUG INPUT VALIDATION (live) ───────────────────── */
function validateSlugInput() {
  const slug = document.getElementById('custom-slug').value.trim();
  const el   = document.getElementById('slug-status');
  if (!slug) { el.textContent = ''; el.className = 'slug-status'; return; }
  const v = validateSlug(slug);
  el.textContent = v.ok ? (v.msg || '') : v.msg;
  el.className   = `slug-status ${v.ok ? 'ok' : 'err'}`;
}

/* ── EVENT LISTENERS ─────────────────────────────────── */
document.getElementById('custom-slug').addEventListener('input', () => {
  validateSlugInput();
  updatePreview();
});

document.getElementById('long-url').addEventListener('input', function() {
  document.getElementById('clear-btn').style.display = this.value ? 'flex' : 'none';
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && ['long-url','custom-slug'].includes(e.target.id)) shortenURL();
  if (e.key === 'Escape') closeModal();
});

/* ── INIT ────────────────────────────────────────────── */
renderHistory();
updateStats();
