/* =====================================================
   ShortLink — App Logic
   Link data (redirect target)   : Redis via /api routes → shared, works for anyone
   "My Links" history            : localStorage → private per browser
   Click counts on history items : fetched live from server
   ===================================================== */

'use strict';

/* ── CONFIG ─────────────────────────────────────────── */
const CFG = {
  baseUrl:     'https://s.taqi.qzz.io',
  displayBase: 's.taqi.qzz.io',
  localKey:    'taqi_my_links',
};

function buildShortUrl(slug)   { return `${CFG.baseUrl}/${encodeURIComponent(slug)}`; }
function buildDisplayUrl(slug) { return `${CFG.displayBase}/${slug}`; }

/* ── LOCAL HISTORY (per-browser, private) ────────────── */
function getLocalLinks() {
  try { return JSON.parse(localStorage.getItem(CFG.localKey)) || {}; }
  catch { return {}; }
}
function saveLocalLinks(map) { localStorage.setItem(CFG.localKey, JSON.stringify(map)); }

function addLocalLink(entry) {
  const map = getLocalLinks();
  map[entry.slug] = {
    slug: entry.slug,
    original: entry.original,
    createdAt: entry.createdAt,
    expiresAt: entry.expiresAt || null,
    protected: !!entry.protected,
  };
  saveLocalLinks(map);
}
function removeLocalLink(slug) { const m = getLocalLinks(); delete m[slug]; saveLocalLinks(m); }
function clearLocalLinks()     { localStorage.removeItem(CFG.localKey); }

/* ── API HELPERS (talk to the shared server-side store) ─ */
async function apiCreate(url, slug, expiresAt, password) {
  const res = await fetch('/api/shorten', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, slug: slug || undefined, expiresAt: expiresAt || undefined, password: password || undefined }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data.entry;
}

async function apiListBySlugs(slugs) {
  if (!slugs.length) return [];
  const res = await fetch(`/api/links?slugs=${encodeURIComponent(slugs.join(','))}`);
  if (!res.ok) throw new Error('Failed to load links.');
  const data = await res.json();
  return data.links || [];
}

async function apiCheckSlug(slug) {
  const res = await fetch(`/api/check?slug=${encodeURIComponent(slug)}`);
  if (!res.ok) return { available: true };
  return res.json();
}

async function apiDelete(slug) {
  const res = await fetch(`/api/links?slug=${encodeURIComponent(slug)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete link.');
}

async function apiDeleteMany(slugs) {
  if (!slugs.length) return;
  const res = await fetch(`/api/links?slugs=${encodeURIComponent(slugs.join(','))}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to clear links.');
}

async function apiUpdate(slug, url) {
  const res = await fetch('/api/links', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, url }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update link.');
  return data.entry;
}

/* ── LOCAL CACHE FOR RENDERING (merged local + live click counts) ── */
let cachedLinks = [];

/* ── INTERACTIVE CARD EFFECT ────────────────────────── */
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

/* ── RANDOM SLUG GENERATOR (short alphanumeric, e.g. "aq7i3") ── */
const SLUG_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SLUG_LEN   = 5;

function rndSlug() {
  let s = '';
  for (let i = 0; i < SLUG_LEN; i++) {
    s += SLUG_CHARS[Math.floor(Math.random() * SLUG_CHARS.length)];
  }
  return s;
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

/* ── EXPIRY SELECTOR ──────────────────────────────────── */
function getSelectedExpiry() {
  const active = document.querySelector('.expiry-opt.active');
  const value  = active ? active.dataset.value : 'never';

  if (value === 'never') return null;
  if (value === '7d')    return Date.now() + 7  * 24 * 60 * 60 * 1000;
  if (value === '30d')   return Date.now() + 30 * 24 * 60 * 60 * 1000;

  if (value === 'custom') {
    const dateEl = document.getElementById('expiry-custom-date');
    if (!dateEl.value) return null;
    const ts = new Date(dateEl.value + 'T23:59:59').getTime();
    return Number.isFinite(ts) ? ts : null;
  }
  return null;
}

function resetExpirySelector() {
  document.querySelectorAll('.expiry-opt').forEach(b => b.classList.remove('active'));
  document.querySelector('.expiry-opt[data-value="never"]').classList.add('active');
  document.getElementById('expiry-custom-date').classList.remove('show');
  document.getElementById('expiry-custom-date').value = '';
}

/* ── PASSWORD PROTECTION TOGGLE ──────────────────────── */
function togglePasswordProtection() {
  const toggle = document.getElementById('pw-toggle');
  const row    = document.getElementById('pw-input-row');
  const label  = document.getElementById('pw-toggle-label');
  const isOn   = toggle.classList.toggle('on');
  toggle.setAttribute('aria-checked', isOn ? 'true' : 'false');
  row.classList.toggle('show', isOn);
  label.textContent = isOn ? 'A password will be required to open this link' : 'Anyone with the link can open it';
  if (isOn) setTimeout(() => document.getElementById('link-password').focus(), 200);
  else document.getElementById('link-password').value = '';
}

function resetPasswordToggle() {
  document.getElementById('pw-toggle').classList.remove('on');
  document.getElementById('pw-toggle').setAttribute('aria-checked', 'false');
  document.getElementById('pw-input-row').classList.remove('show');
  document.getElementById('pw-toggle-label').textContent = 'Anyone with the link can open it';
  document.getElementById('link-password').value = '';
}

function expiryLabel(expiresAt) {
  if (!expiresAt) return null;
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 'Expired';
  const days = Math.ceil(diff / 86400000);
  if (days <= 1) return 'Expires today';
  if (days < 30) return `Expires in ${days}d`;
  const d = new Date(expiresAt);
  return `Expires ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/* ── SLUG AVAILABILITY (debounced, hits the server) ──── */
let _slugCheckTimer = null;

function scheduleSlugCheck(slug) {
  clearTimeout(_slugCheckTimer);
  const el = document.getElementById('slug-status');

  if (!slug) { el.textContent = ''; el.className = 'slug-status'; return; }

  el.textContent = 'Checking...';
  el.className   = 'slug-status';

  _slugCheckTimer = setTimeout(async () => {
    try {
      const v = await apiCheckSlug(slug);
      el.textContent = v.reason || '';
      el.className   = `slug-status ${v.available ? 'ok' : 'err'}`;
    } catch {
      el.textContent = '';
      el.className   = 'slug-status';
    }
  }, 400);
}

/* ── CORE: SHORTEN ──────────────────────────────────── */
let lastEntry = null;

async function shortenURL() {
  const urlEl  = document.getElementById('long-url');
  const slugEl = document.getElementById('custom-slug');
  const btn    = document.getElementById('shorten-btn');
  const rowEl  = urlEl.closest('.field-row');

  let rawUrl = urlEl.value.trim();
  let slug   = slugEl.value.trim();

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

  btn.disabled = true;
  document.getElementById('btn-label').textContent = 'Generating...';

  const expiresAt = getSelectedExpiry();
  const pwEnabled = document.getElementById('pw-toggle').classList.contains('on');
  const password  = pwEnabled ? document.getElementById('link-password').value : '';

  if (pwEnabled && password.trim().length < 4) {
    showToast('error', 'Password must be at least 4 characters.');
    return;
  }

  try {
    const entry = await apiCreate(rawUrl, slug, expiresAt, password);
    lastEntry = entry;

    addLocalLink(entry); // save into THIS browser's private history only

    showResult(entry);
    await refreshAll();
    showToast('ok', 'Link successfully created!');
  } catch (err) {
    showToast('error', err.message || 'Something went wrong.');
  } finally {
    btn.disabled = false;
    document.getElementById('btn-label').textContent = 'Shorten URL';
  }
}

function showResult(entry) {
  const wrap   = document.getElementById('result-wrap');
  const linkEl = document.getElementById('result-link');
  const origEl = document.getElementById('result-orig');
  const cpBtn  = document.getElementById('copy-btn');

  const short   = buildShortUrl(entry.slug);
  const display = buildDisplayUrl(entry.slug);
  entry.short   = short;
  entry.display = display;

  linkEl.href = short;
  try { origEl.textContent = 'Redirects to: ' + new URL(entry.original).hostname; }
  catch { origEl.textContent = 'Redirects to: ' + entry.original.slice(0, 40) + '...'; }

  let expiryEl = document.getElementById('result-expiry');
  if (!expiryEl) {
    expiryEl = document.createElement('div');
    expiryEl.id = 'result-expiry';
    expiryEl.className = 'result-expiry';
    origEl.insertAdjacentElement('afterend', expiryEl);
  }
  const label = expiryLabel(entry.expiresAt);
  expiryEl.textContent = label ? `⏱ ${label}` : '';
  expiryEl.style.display = label ? 'block' : 'none';

  let lockEl = document.getElementById('result-locked');
  if (!lockEl) {
    lockEl = document.createElement('div');
    lockEl.id = 'result-locked';
    lockEl.className = 'result-locked';
    expiryEl.insertAdjacentElement('afterend', lockEl);
  }
  lockEl.textContent = entry.protected ? '🔒 Password protected' : '';
  lockEl.style.display = entry.protected ? 'block' : 'none';

  cpBtn.classList.remove('copied');
  cpBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Copy</span>`;

  wrap.style.display = 'block';
  setTimeout(() => { wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 100);

  linkEl.textContent = '';
  scrambleReveal(linkEl, display, 700);
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
  resetExpirySelector();
  resetPasswordToggle();
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
  const s = rndSlug();
  document.getElementById('custom-slug').value = s;
  updatePreview();
  scheduleSlugCheck(s);

  const btn = document.getElementById('dice-btn');
  btn.style.transition = 'transform 0.3s ease';
  btn.style.transform  = 'rotate(180deg)';
  setTimeout(() => { btn.style.transform = 'rotate(360deg)'; }, 200);
  setTimeout(() => { btn.style.transform = ''; btn.style.transition = ''; }, 400);
}

/* ── HISTORY (rendered from cachedLinks, sourced from local history) ── */
function renderHistory(filter = '') {
  const entries = [...cachedLinks].sort((a, b) => b.createdAt - a.createdAt);
  const list  = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  const caBtn = document.getElementById('clear-all-btn');

  if (entries.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'flex';
    caBtn.style.display = 'none';
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
    const clicks  = e.clicks || 0;
    const short   = buildShortUrl(e.slug);
    const display = buildDisplayUrl(e.slug);
    const expLabel = expiryLabel(e.expiresAt);
    return `
    <div class="hist-item" id="hi-${e.slug}">
      <div class="hist-initials">${initials}</div>
      <div class="hist-info">
        <div class="hist-short-row">
          <a class="hist-link" href="${esc(short)}" target="_blank" rel="noopener">${esc(display)}</a>
          <span class="hist-clicks">${clicks} click${clicks !== 1 ? 's' : ''}</span>
          ${expLabel ? `<span class="hist-expiry">⏱ ${esc(expLabel)}</span>` : ''}
          ${e.protected ? `<span class="hist-locked">🔒 Locked</span>` : ''}
        </div>
        <div class="hist-orig" title="${esc(e.original)}">${esc(e.original)}</div>
      </div>
      <span class="hist-date">${ago(e.createdAt)}</span>
      <div class="hist-actions">
        <button class="hbtn edit" title="Edit destination" onclick="askEdit('${esc(e.slug)}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>
        <button class="hbtn" title="Copy" onclick="copyHistItem('${esc(short)}',this)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button class="hbtn qr" title="QR Code" onclick="showQrModal('${esc(short)}')">
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

/* ── STATS (based on THIS browser's own history) ─────── */
function updateStats() {
  tickNum(document.getElementById('stat-total'),  cachedLinks.length);
  tickNum(document.getElementById('stat-clicks'), cachedLinks.reduce((s, e) => s + (e.clicks || 0), 0));
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

/* ── REFRESH: read local slugs, pull live click counts from server ── */
async function refreshAll() {
  const localMap = getLocalLinks();
  const slugs    = Object.keys(localMap);

  if (!slugs.length) {
    cachedLinks = [];
  } else {
    try {
      const serverEntries = await apiListBySlugs(slugs);
      const bySlug = Object.fromEntries(serverEntries.map(e => [e.slug, e]));

      cachedLinks = slugs.filter(s => bySlug[s]).map(s => bySlug[s]);

      // If a link was deleted server-side (e.g. from another tab), drop it locally too
      if (cachedLinks.length !== slugs.length) {
        const prunedMap = {};
        cachedLinks.forEach(e => { prunedMap[e.slug] = localMap[e.slug]; });
        saveLocalLinks(prunedMap);
      }
    } catch {
      showToast('error', 'Could not refresh link stats.');
      cachedLinks = slugs.map(s => ({ ...localMap[s], clicks: 0 }));
    }
  }

  const q = document.getElementById('history-search').value.trim().toLowerCase();
  renderHistory(q);
  updateStats();
}

/* ── DELETE MODAL ────────────────────────────────────── */
let _pendingSlug = null;

function askDelete(slug) {
  _pendingSlug = slug;
  document.getElementById('modal-title').textContent = 'Remove this link?';
  document.getElementById('modal-msg').textContent   = `The link s.taqi.qzz.io/${slug} will be permanently deleted and will stop working for anyone who has it.`;
  document.getElementById('modal-confirm').onclick   = doDelete;
  document.getElementById('modal-bg').style.display  = 'flex';
}

async function doDelete() {
  if (_pendingSlug) {
    try { await apiDelete(_pendingSlug); }
    catch { showToast('error', 'Failed to delete link.'); }
    removeLocalLink(_pendingSlug);
    _pendingSlug = null;
  }
  closeModal();
  await refreshAll();
  showToast('ok', 'Link removed successfully.');
}

function clearAllLinks() {
  document.getElementById('modal-title').textContent = 'Clear all your links?';
  document.getElementById('modal-msg').textContent   = 'All links in your history will be permanently deleted and will stop working for anyone who has them. This action cannot be undone.';
  document.getElementById('modal-confirm').onclick   = async () => {
    const slugs = Object.keys(getLocalLinks());
    try { await apiDeleteMany(slugs); }
    catch { showToast('error', 'Failed to clear links.'); }
    clearLocalLinks();
    closeModal();
    await refreshAll();
    showToast('ok', 'All your links have been cleared.');
  };
  document.getElementById('modal-bg').style.display = 'flex';
}

function closeModalAnimated(id) {
  const el = document.getElementById(id);
  if (!el || el.style.display === 'none') return;
  el.classList.add('closing');
  setTimeout(() => {
    el.style.display = 'none';
    el.classList.remove('closing');
  }, 280);
}

function closeModal() { closeModalAnimated('modal-bg'); }
function handleModalBgClick(e) { if (e.target.id === 'modal-bg') closeModal(); }

/* ── EDIT MODAL ──────────────────────────────────────── */
let _editingSlug = null;

function askEdit(slug) {
  const entry = cachedLinks.find(e => e.slug === slug);
  if (!entry) return;

  _editingSlug = slug;
  document.getElementById('edit-modal-slug-label').textContent = buildDisplayUrl(slug);
  document.getElementById('edit-url-input').value = entry.original;
  document.getElementById('edit-modal-bg').style.display = 'flex';
  setTimeout(() => document.getElementById('edit-url-input').focus(), 50);
}

async function doEdit() {
  const input = document.getElementById('edit-url-input');
  const btn   = document.getElementById('edit-modal-save');
  let newUrl  = input.value.trim();

  if (!newUrl) { showToast('error', 'Please enter a URL.'); return; }
  if (!/^https?:\/\//i.test(newUrl)) newUrl = 'https://' + newUrl;
  try { new URL(newUrl); }
  catch { showToast('error', "That doesn't look like a valid URL."); return; }

  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    await apiUpdate(_editingSlug, newUrl);
    closeEditModal();
    await refreshAll();
    showToast('ok', 'Destination updated successfully.');
  } catch (err) {
    showToast('error', err.message || 'Failed to update link.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save changes';
  }
}

function closeEditModal() {
  closeModalAnimated('edit-modal-bg');
  _editingSlug = null;
}

function handleEditModalBgClick(e) { if (e.target.id === 'edit-modal-bg') closeEditModal(); }

/* ── PASSWORD UNLOCK FLOW ─────────────────────────────── */
async function apiResolve(slug) {
  const res = await fetch(`/api/resolve?slug=${encodeURIComponent(slug)}`);
  if (!res.ok) return { found: false };
  return res.json();
}

async function apiUnlock(slug, password) {
  const res = await fetch('/api/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Incorrect password.');
  return data.url;
}

let _unlockSlug = null;

function openUnlockModal(slug) {
  _unlockSlug = slug;
  document.getElementById('unlock-error').style.display = 'none';
  document.getElementById('unlock-password-input').value = '';
  document.getElementById('unlock-modal-bg').style.display = 'flex';
  setTimeout(() => document.getElementById('unlock-password-input').focus(), 100);
}

function closeUnlockModal() {
  closeModalAnimated('unlock-modal-bg');
  _unlockSlug = null;
}

async function submitUnlock() {
  const input = document.getElementById('unlock-password-input');
  const errEl = document.getElementById('unlock-error');
  const btn   = document.getElementById('unlock-submit-btn');
  const password = input.value;

  if (!password) {
    errEl.textContent = 'Please enter the password.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Checking...';
  errEl.style.display = 'none';

  try {
    const url = await apiUnlock(_unlockSlug, password);
    window.location.replace(url);
  } catch (err) {
    errEl.textContent = err.message || 'Incorrect password.';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Unlock';
  }
}

async function checkForProtectedLink() {
  const slug = decodeURIComponent(window.location.pathname.slice(1)).replace(/\/$/, '');
  if (!slug) return;
  try {
    const result = await apiResolve(slug);
    if (result.found && result.protected) {
      openUnlockModal(slug);
    }
  } catch { /* silently ignore, just show the landing page */ }
}

/* ── QR CODE ─────────────────────────────────────────── */
let _qrCurrentUrl = null;

function qrImageUrl(url, sizePx) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${sizePx}x${sizePx}&margin=10&data=${encodeURIComponent(url)}`;
}

function showQrModal(url) {
  if (!url) {
    showToast('error', 'Shorten a link first to generate its QR code.');
    return;
  }
  _qrCurrentUrl = url;

  const urlLabel = document.getElementById('qr-modal-url');
  try { urlLabel.textContent = url.replace(/^https?:\/\//, ''); }
  catch { urlLabel.textContent = url; }

  const wrap    = document.getElementById('qr-canvas-wrap');
  const img     = document.getElementById('qr-code-img');
  const modalBg = document.getElementById('qr-modal-bg');

  wrap.classList.add('loading');
  img.style.visibility = 'hidden';
  modalBg.style.display = 'flex';

  img.crossOrigin = 'anonymous';
  img.onload = () => {
    if (_qrCurrentUrl !== url) return;
    wrap.classList.remove('loading');
    img.style.visibility = 'visible';
  };
  img.onerror = () => {
    if (_qrCurrentUrl !== url) return;
    wrap.classList.remove('loading');
    showToast('error', 'Could not load the QR code. Check your internet connection.');
  };
  img.src = qrImageUrl(url, 240);
}

function closeQrModal() {
  closeModalAnimated('qr-modal-bg');
  _qrCurrentUrl = null;
}

function handleQrModalBgClick(e) { if (e.target.id === 'qr-modal-bg') closeQrModal(); }

function downloadQr() {
  const img = document.getElementById('qr-code-img');
  if (!_qrCurrentUrl || !img.complete || !img.naturalWidth) {
    showToast('error', 'QR code is not ready yet.');
    return;
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const a = document.createElement('a');
    a.download = `qrcode-${_qrCurrentUrl.split('/').pop() || 'shortlink'}.png`;
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('ok', 'QR code downloaded.');
  } catch (err) {
    console.error(err);
    window.open(img.src, '_blank');
    showToast('ok', 'Opened the QR code in a new tab — right-click (or long-press) it to save.');
  }
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

/* ── ACCORDION (FAQ & Legal) ─────────────────────────── */
document.querySelectorAll('.accordion').forEach(acc => {
  acc.querySelectorAll('.acc-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.acc-item');
      const isOpen = item.classList.contains('open');
      acc.querySelectorAll('.acc-item.open').forEach(el => { if (el !== item) el.classList.remove('open'); });
      item.classList.toggle('open', !isOpen);
    });
  });
});

/* ── EVENT LISTENERS ─────────────────────────────────── */
document.getElementById('custom-slug').addEventListener('input', () => {
  const slug = document.getElementById('custom-slug').value.trim();
  scheduleSlugCheck(slug);
  updatePreview();
});

document.getElementById('long-url').addEventListener('input', function() {
  document.getElementById('clear-btn').style.display = this.value ? 'flex' : 'none';
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && ['long-url','custom-slug'].includes(e.target.id)) shortenURL();
  if (e.key === 'Enter' && e.target.id === 'edit-url-input') doEdit();
  if (e.key === 'Enter' && e.target.id === 'unlock-password-input') submitUnlock();
  if (e.key === 'Escape') { closeModal(); closeQrModal(); closeEditModal(); closeUnlockModal(); }
});

document.querySelectorAll('.expiry-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.expiry-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const dateEl = document.getElementById('expiry-custom-date');
    if (btn.dataset.value === 'custom') {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      dateEl.min = tomorrow;
      dateEl.classList.add('show');
      setTimeout(() => dateEl.focus(), 200);
    } else {
      dateEl.classList.remove('show');
    }
  });
});

/* ── INIT ────────────────────────────────────────────── */
refreshAll();
checkForProtectedLink();

/* ── MOBILE NAV DROPDOWN ──────────────────────────────── */
function toggleMobileNav() {
  document.getElementById('nav-dropdown').classList.toggle('open');
  document.getElementById('nav-burger').classList.toggle('open');
}
function closeMobileNav() {
  document.getElementById('nav-dropdown').classList.remove('open');
  document.getElementById('nav-burger').classList.remove('open');
}
document.addEventListener('click', e => {
  const dropdown = document.getElementById('nav-dropdown');
  const burger   = document.getElementById('nav-burger');
  if (dropdown.classList.contains('open') && !dropdown.contains(e.target) && !burger.contains(e.target)) {
    closeMobileNav();
  }
});