import { REFRESH_INTERVAL_MS } from './config.js';
import { loadS, saveS } from './storage.js';
import { state } from './state.js';
import { buildQuick } from './search.js';
import { showToast } from './ui.js';

export function setDataStatus(s, date) {
  const el = document.getElementById('data-status');
  const btn = document.getElementById('refresh-btn');
  btn.classList.remove('spinning');
  if (s === 'loading') {
    el.className = 'data-bar-status'; el.textContent = 'Refreshing data…'; btn.classList.add('spinning');
  } else if (s === 'ok') {
    const lastRefresh = loadS('sr_last_refresh', 0);
    const mins = Math.round((Date.now() - lastRefresh) / 60000);
    const ago = mins < 2 ? 'just now' : mins < 60 ? mins + 'm ago' : Math.round(mins / 60) + 'h ago';
    el.className = 'data-bar-status ok';
    el.textContent = `✓ Data current · updated ${ago}${date ? ' (' + date + ')' : ''}`;
  } else if (s === 'error') {
    el.className = 'data-bar-status error'; el.textContent = '⚠ Could not reach server — using cached data';
  } else if (s === 'stale') {
    el.className = 'data-bar-status stale'; el.textContent = '⏱ Data may be outdated — tap Refresh';
  }
}

export async function loadData(forceNetwork = false) {
  setDataStatus('loading');
  try {
    const bust = forceNetwork ? '?t=' + Date.now() : '';
    const [cardsRes, vendorsRes] = await Promise.all([
      fetch('cards.json' + bust),
      fetch('vendors.json' + bust),
    ]);
    if (!cardsRes.ok || !vendorsRes.ok) throw new Error('Fetch failed');
    const cardsData = await cardsRes.json();
    const vendorsData = await vendorsRes.json();

    state.CARD_CATALOG = cardsData.cards || [];
    state.VENDOR_DB = vendorsData.vendors || [];
    state.DATA_META = cardsData.meta || {};

    saveS('sr_last_refresh', Date.now());
    const discDate = document.getElementById('disc-date');
    if (discDate) discDate.textContent = state.DATA_META.lastUpdated || 'Unknown';
    setDataStatus('ok', state.DATA_META.lastUpdated);
    buildQuick();
    populateCardSelect();
    if (document.getElementById('panel-wallet').classList.contains('active')) {
      const { renderWallet } = await import('./wallet.js');
      renderWallet();
    }
    return true;
  } catch (e) {
    setDataStatus('error');
    state.CARD_CATALOG = [];
    state.VENDOR_DB = [];
    return false;
  }
}

export async function refreshData() {
  document.getElementById('refresh-btn').classList.add('spinning');
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage('REFRESH_DATA');
  }
  const ok = await loadData(true);
  showToast(ok ? '✓ Card data refreshed' : 'Could not refresh — using cached data', ok ? 'success' : 'error');
}

export function checkAutoRefresh() {
  const last = loadS('sr_last_refresh', 0);
  if (Date.now() - last > REFRESH_INTERVAL_MS) {
    loadData(true);
  } else {
    loadData(false);
    if (Date.now() - last > REFRESH_INTERVAL_MS * 0.95) setDataStatus('stale');
  }
}

function populateCardSelect() {}
