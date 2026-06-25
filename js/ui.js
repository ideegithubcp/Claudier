import { state } from './state.js';
import { renderWallet } from './wallet.js';

export function escHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
export function escAttr(s) { return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
// For values injected as JS string arguments inside onclick="fn('...')" attributes.
// Uses backslash escaping (not HTML entities) so the browser's HTML-entity-decoder
// cannot turn &#x27; back into a raw ' that breaks the JS string delimiter.
export function escJs(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/</g, '\\x3c').replace(/>/g, '\\x3e'); }
export function haptic(ms = 10) { if (navigator.vibrate) navigator.vibrate(ms); }

export function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast' + (type ? ' ' + type : '');
  void t.offsetWidth; t.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

export function switchTab(t) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-' + t).classList.add('active');
  document.getElementById('panel-' + t).classList.add('active');
  if (t === 'wallet') renderWallet();
  if (t === 'gps') import('./places.js').then(({ initNearbyTab }) => initNearbyTab());
  if (t === 'stats') import('./stats.js').then(({ renderStatsPanel }) => renderStatsPanel());
  // Track tab switch as virtual page view (GoatCounter)
  if (window.goatcounter?.count) {
    window.goatcounter.count({ path: '/tab/' + t, title: 'Tab: ' + t });
  }
}

export function initVisitorCount() {
  fetch('https://swiperight.goatcounter.com/counter//.json')
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data?.count) return;
      const el = document.getElementById('visit-count');
      if (el) el.textContent = '👥 ' + data.count + ' visits';
    })
    .catch(() => {}); // silently ignore — analytics is non-critical
}

export function openDisclaimer() { document.getElementById('disc-overlay').classList.add('show'); }
export function closeDisclaimer() { document.getElementById('disc-overlay').classList.remove('show'); }
export function closeBanner() { document.getElementById('install-banner').classList.remove('show'); }

const MASCOT_MOODS = [
  '😊','😉','👍','🤑','💪','😎','🤩','🎯',
  '✨','🏆','💡','🎉','🚀','💰','🤝','😄',
];

export function startMascot() {
  const el = document.getElementById('mascot-emoji');
  if (!el) return;
  let idx = Math.floor(Math.random() * MASCOT_MOODS.length);

  function setMood() {
    el.classList.remove('pop');
    void el.offsetWidth; // force reflow to restart animation
    el.textContent = MASCOT_MOODS[idx];
    el.classList.add('pop');
    idx = (idx + 1) % MASCOT_MOODS.length;
  }

  setMood(); // set on open
  setInterval(setMood, 5 * 60 * 1000); // rotate every 5 minutes
  el.addEventListener('click', setMood); // tap to change immediately
}

export function startClock() {
  const timeEl = document.getElementById('clock-time');
  const dateEl = document.getElementById('clock-date');
  function tick() {
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    dateEl.textContent = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }
  tick();
  setInterval(tick, 1000);
}

export function initKeyboardHandlers() {
  document.getElementById('vendorInput').addEventListener('keydown', e => {
    if (e.key === 'Escape') document.getElementById('suggestions').style.display = 'none';
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ['modal-overlay', 'custom-overlay', 'disc-overlay', 'edit-overlay'].forEach(id => {
        document.getElementById(id).classList.remove('show');
      });
    }
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#suggestions') && !e.target.closest('#vendorInput'))
      document.getElementById('suggestions').style.display = 'none';
  });
}

export function initPWAInstall() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); state.deferredPrompt = e;
    document.getElementById('install-banner').classList.add('show');
  });
  document.getElementById('install-btn').addEventListener('click', async () => {
    if (!state.deferredPrompt) return;
    state.deferredPrompt.prompt();
    await state.deferredPrompt.userChoice;
    state.deferredPrompt = null;
    document.getElementById('install-banner').classList.remove('show');
  });
}

export function showOnboardingIfNew() {
  if (state.myCardIds.length === 0 && state.customCards.length === 0) {
    setTimeout(() => {
      const b = document.createElement('div');
      b.style.cssText = 'margin:0 20px 8px;background:rgba(74,229,162,.08);border:1px solid rgba(74,229,162,.25);border-radius:14px;padding:11px 13px;display:flex;align-items:center;gap:10px;';
      b.innerHTML = `<div style="flex:1;font-size:13px;color:var(--accent);">👋 <strong>Welcome!</strong> Add your cards for personalized picks.</div><button onclick="switchTab('wallet')" style="background:linear-gradient(90deg,#4AE5A2,#00C6B8);color:#0F1117;border:none;padding:7px 14px;border-radius:99px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">Set up →</button><button onclick="this.parentElement.remove()" style="color:var(--muted);background:none;border:none;font-size:20px;cursor:pointer;padding:4px;flex-shrink:0;" aria-label="Dismiss">×</button>`;
      document.getElementById('install-banner').insertAdjacentElement('afterend', b);
    }, 700);
  }
}
