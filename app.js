/* =====================================================
   ShortLink — App Logic
   Storage: localStorage
   Redirect: ?s=<slug> query param
   Domain: https://s.taqi.qzz.io
   ===================================================== */

'use strict';

/* ── CONFIG ─────────────────────────────────────────── */
const CFG = {
  baseUrl:    'https://s.taqi.qzz.io',
  displayBase: 's.taqi.qzz.io',
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

/* ── INTERACTIVE CARD EFFECT ────────────────────────── */
// Magnetic/glow effect that follows the mouse on the form card
const card = document.getElementById('form-card');
if (card) {
  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--x', `${x}px`);
    card.style.setProperty('--y', `${y}px`);
  });
}

/* ── REDIRECT ───────────────────────────────────────── */
(function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const slug   = params.get('s');
  if (!slug) return;

  const entry = getLinks()[slug];
  if (!entry) {
    history.replaceState({}, '', window.location.pathname);
    return;
  }

  bumpClick(slug);

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
  return { ok: true, msg: 'Awesome! It\'s available.' };
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
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function scrambleReveal(el, finalText, duration = 800) {
  const totalFrames = Math.ceil(duration / 30);
  let frame = 0;

  const tick = setInterval(() => {
    frame++;
    const progress  = frame / totalFrames;
    const revealed  = Math.floor(progress * finalText.length);
    let out = finalText.slice(0, revealed);
    const noise = Math.min(finalText.length - revealed, 4);
    for (let i = 0; i < noise; i++) {
      out += CHARS[Math.floor(Math.random() * CHARS.length)];
    }
    el.textContent = out;
    if (frame >= totalFrames) { clearInterval(tick); el.textContent = finalText; }
  }, 30);
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
  const rowEl   = urlEl.closest('.field-row');

  let rawUrl = urlEl.value.trim();
  let slug   = slugEl.value.trim();

  // Validate URL
  if (!rawUrl) {
    rowEl.classList.add('err'); shake(rowEl);
    showToast('error', 'Please enter a URL first.');
    setTimeout(() => rowEl.classList.remove('err'), 1400);
    return;
  }
  if (!/^https?:\/\//i.test(rawUrl)) rawUrl = 'https://' + rawUrl;
  try { new URL(rawUrl); }
  catch {
    rowEl.classList.add('err'); shake(rowEl);
    showToast('error', 'That doesn\'t look like a valid URL.');
    setTimeout(() => rowEl.classList.remove('err'), 1400);
    return;
  }

  // Validate slug
  if (slug) {
    const v = validateSlug(slug);
    if (!v.ok) { showToast('error', v.msg); return; }
  } else {
    let attempt = rndSlug();
    let tries   = 0;
    while (getLinks()[attempt] && tries++ < 20) attempt = rndSlug();
    slug = attempt;
  }

  // Animate button
  btn.disabled = true;
  document.getElementById('btn-label').textContent = 'Generating...';

  // Brief delay to feel like it's "processing"
  setTimeout(() => {
    const entry = addLink(slug, rawUrl);
    lastEntry   = entry;

    btn.disabled = false;
    document.getElementById('btn-label').textContent = 'Shorten URL';

    showResult(entry);
    updateStats();
    renderHistory();
    showToast('ok', 'Link successfully created!');
  }, 600);
}

function showResult(entry) {
  const wrap = document.getElementById('result-wrap');
  const linkEl = document.getElementById('result-link');
  const origEl = document.getElementById('result-orig');
  const cpBtn  = document.getElementById('copy-btn');

  linkEl.href = entry.short;
  try { origEl.textContent = 'Redirects to: ' + new URL(entry.original).hostname; }
  catch { origEl.textContent = 'Redirects to: ' + entry.original.slice(0, 40) + '...'; }

  cpBtn.classList.remove('copied');
  cpBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Copy</span>`;

  wrap.style.display = 'block';

  // Auto scroll to result smoothly
  setTimeout(() => {
    wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 100);

  linkEl.textContent = '';
  scrambleReveal(linkEl, entry.display, 700);
}

function copyResult() {
  if (!lastEntry) return;
  copyText(lastEntry.short);
  const btn = document.getElementById('copy-btn');
  btn.classList.add('copied');
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>Copied</span>`;
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Copy</span>`;
  }, 2000);
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
  caBtn.style.display = 'flex';

  const filtered = filter
    ? entries.filter(e => e.slug.toLowerCase().includes(filter) || e.original.toLowerCase().includes(filter))
    : entries;

  if (filtered.length === 0) {
    list.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-faint);font-size:.9rem">No results found for "${esc(filter)}"</div>`;
    return;
  }

  list.innerHTML = filtered.map(e => {
    let initials = 'URL';
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
        <button class="hbtn" title="Copy" onclick="copyHistItem('${esc(e.short)}',this)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button class="hbtn qr" title="QR Code" onclick="showQrModal('${esc(e.short)}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><line x1="14" y1="14" x2="14" y2="21"/><line x1="21" y1="14" x2="21" y2="21"/><line x1="14" y1="14" x2="21" y2="14"/><line x1="14" y1="21" x2="21" y2="21"/></svg>
        </button>
        <button class="hbtn del" title="Delete" onclick="askDelete('${esc(e.slug)}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
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
  const steps = Math.min(Math.abs(delta), 20);
  let cur = from, i = 0;
  const t = setInterval(() => {
    i++;
    cur += delta / steps;
    el.textContent = Math.round(i < steps ? cur : target);
    if (i >= steps) clearInterval(t);
  }, 20);
}

/* ── DELETE MODAL ────────────────────────────────────── */
let _pendingSlug = null;

function askDelete(slug) {
  _pendingSlug = slug;
  document.getElementById('modal-title').textContent = 'Remove this link?';
  document.getElementById('modal-msg').textContent   = `The link s.taqi.qzz.io/?s=${slug} will be permanently removed from your library.`;
  document.getElementById('modal-confirm').onclick   = doDelete;
  document.getElementById('modal-bg').style.display  = 'flex';
}

function doDelete() {
  if (_pendingSlug) { removeLink(_pendingSlug); _pendingSlug = null; }
  closeModal();
  renderHistory();
  updateStats();
  showToast('ok', 'Link removed successfully.');
}

function clearAllLinks() {
  document.getElementById('modal-title').textContent = 'Clear all links?';
  document.getElementById('modal-msg').textContent   = 'All your saved links will be permanently deleted. This action cannot be undone.';
  document.getElementById('modal-confirm').onclick   = () => {
    nukeLinks();
    closeModal();
    renderHistory();
    updateStats();
    showToast('ok', 'All links have been cleared.');
  };
  document.getElementById('modal-bg').style.display = 'flex';
}

function closeModal() { document.getElementById('modal-bg').style.display = 'none'; }
function handleModalBgClick(e) { if (e.target.id === 'modal-bg') closeModal(); }

/* ── QR CODE ─────────────────────────────────────────── */
let _qrCurrentUrl  = null;
let _qrLibPromise  = null;

// Several CDN mirrors in case one is slow, down, or blocked by the network/extensions.
const QR_LIB_SOURCES = [
  'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
  'https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.3/qrcode.min.js',
];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => (typeof QRCode !== 'undefined')
      ? resolve()
      : reject(new Error('Loaded but QRCode is not defined: ' + src));
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

// Tries each CDN mirror in order until one succeeds; caches the resulting promise.
function loadQrLib() {
  if (typeof QRCode !== 'undefined') return Promise.resolve();
  if (_qrLibPromise) return _qrLibPromise;

  _qrLibPromise = QR_LIB_SOURCES.reduce(
    (chain, src) => chain.catch(() => loadScript(src)),
    Promise.reject(new Error('init'))
  ).catch(err => {
    _qrLibPromise = null; // allow retrying next time (e.g. connection restored)
    throw err;
  });

  return _qrLibPromise;
}

async function showQrModal(url) {
  if (!url) {
    showToast('error', 'Shorten a link first to generate its QR code.');
    return;
  }
  _qrCurrentUrl = url;

  const urlLabel = document.getElementById('qr-modal-url');
  try { urlLabel.textContent = url.replace(/^https?:\/\//, ''); }
  catch { urlLabel.textContent = url; }

  const canvas  = document.getElementById('qr-canvas');
  const modalBg = document.getElementById('qr-modal-bg');
  const wrap    = canvas.closest('.qr-canvas-wrap');

  // Clear any previous QR and show a loading state while the library/image generate.
  const ctx = canvas.getContext && canvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  wrap.classList.add('loading');
  modalBg.style.display = 'flex';

  try {
    await loadQrLib();
  } catch (err) {
    console.error(err);
    wrap.classList.remove('loading');
    showToast('error', 'Could not load the QR generator. Check your connection and try again.');
    return;
  }

  // The modal may have been closed while the library was loading, or the
  // person may have opened a different link's QR code in the meantime.
  if (modalBg.style.display === 'none' || _qrCurrentUrl !== url) return;

  QRCode.toCanvas(canvas, url, {
    width: 220,
    margin: 2,
    color: { dark: '#0f1115', light: '#ffffff' },
  }, function (error) {
    wrap.classList.remove('loading');
    if (error) {
      console.error(error);
      showToast('error', 'Failed to generate QR code.');
    }
  });
}

function closeQrModal() {
  document.getElementById('qr-modal-bg').style.display = 'none';
  _qrCurrentUrl = null;
}

function handleQrModalBgClick(e) { if (e.target.id === 'qr-modal-bg') closeQrModal(); }

function downloadQr() {
  const canvas = document.getElementById('qr-canvas');
  if (!canvas || !_qrCurrentUrl) return;
  const a = document.createElement('a');
  a.download = `qrcode-${_qrCurrentUrl.split('=').pop() || 'shortlink'}.png`;
  a.href = canvas.toDataURL('image/png');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('ok', 'QR code downloaded.');
}

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

function copyHistItem(short, btn) {
  copyText(short);
  showToast('ok', 'Copied to clipboard');
  const orig = btn.innerHTML;
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
  btn.classList.add('copied-flash');
  setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('copied-flash'); }, 1500);
}

/* ── TOAST ───────────────────────────────────────────── */
function showToast(type, msg) {
  const stack = document.getElementById('toast-stack');
  const icons = {
    ok:  `<div class="toast-ok"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>`,
    error:`<div class="toast-err"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>`,
  };
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `${icons[type] || ''}<span>${esc(msg)}</span>`;
  stack.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 200); }, 3000);
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
  setTimeout(() => document.getElementById('long-url').focus(), 500);
}

/* ── EVENT LISTENERS ─────────────────────────────────── */
document.getElementById('custom-slug').addEventListener('input', () => {
  const slug = document.getElementById('custom-slug').value.trim();
  const el   = document.getElementById('slug-status');
  if (!slug) { el.textContent = ''; el.className = 'slug-status'; }
  else {
    const v = validateSlug(slug);
    el.textContent = v.ok ? (v.msg || '') : v.msg;
    el.className   = `slug-status ${v.ok ? 'ok' : 'err'}`;
  }
  updatePreview();
});

document.getElementById('long-url').addEventListener('input', function() {
  document.getElementById('clear-btn').style.display = this.value ? 'flex' : 'none';
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && ['long-url','custom-slug'].includes(e.target.id)) shortenURL();
  if (e.key === 'Escape') { closeModal(); closeQrModal(); }
});

/* ── INIT ────────────────────────────────────────────── */
renderHistory();
updateStats();