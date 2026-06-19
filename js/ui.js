import { state } from './state.js';
import { renderWallet } from './wallet.js';

export function escHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
export function escAttr(s) { return String(s || '').replace(/'/g, '\''); }

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
}

export function openDisclaimer() { document.getElementById('disc-overlay').classList.add('show'); }
export function closeDisclaimer() { document.getElementById('disc-overlay').classList.remove('show'); }
export function closeBanner() { document.getElementById('install-banner').classList.remove('show'); }

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
