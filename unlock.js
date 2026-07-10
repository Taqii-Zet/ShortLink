'use strict';

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

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

const params = new URLSearchParams(window.location.search);
const slug = params.get('slug') || '';

async function submitUnlock() {
  const input = document.getElementById('unlock-password-input');
  const errEl = document.getElementById('unlock-error');
  const btn   = document.getElementById('unlock-submit-btn');
  const password = input.value;

  if (!slug) {
    errEl.textContent = 'Missing link reference.';
    errEl.style.display = 'block';
    return;
  }
  if (!password) {
    errEl.textContent = 'Please enter the password.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  errEl.style.display = 'none';

  try {
    const res = await fetch('/api/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Incorrect password.');
    window.location.replace(data.url);
  } catch (err) {
    errEl.textContent = err.message || 'Incorrect password.';
    errEl.style.display = 'block';
    btn.disabled = false;
  }
}

document.getElementById('unlock-password-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') submitUnlock();
});

if (!slug) {
  document.getElementById('unlock-notfound').style.display = 'block';
  document.querySelector('.unlock-form').style.display = 'none';
} else {
  document.getElementById('unlock-password-input').focus();
}