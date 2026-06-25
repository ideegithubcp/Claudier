import { checkAutoRefresh, refreshData } from './data.js';
import { switchTab, showToast, openDisclaimer, closeDisclaimer, closeBanner, startClock, startMascot, initKeyboardHandlers, initPWAInstall, showOnboardingIfNew, initVisitorCount } from './ui.js';
import { lookup, clearSearch, onInput, selectSug, quickPick, logCardTap } from './search.js';
import { renderStatsPanel } from './stats.js';
import { startGPS, searchPlacesByText, nearbyPick } from './places.js';
import { renderWallet, setWalletFilter, removeCard, openModal, closeModal, modalOverlayClick, filterCardOptions, toggleCardSelect, saveModalCards, openCustomModal, editCustomCard, closeCustomModal, customOverlayClick, toggleCustomCat, saveCustomCard, exportWallet, importWallet, clearTaps } from './wallet.js';
import { openEditModal, closeEditModal, editOverlayClick, toggleEditCat, saveCardEdit, clearCardEdit } from './overrides.js';

// Expose all functions called from HTML onclick attributes
Object.assign(window, {
  switchTab, showToast, openDisclaimer, closeDisclaimer, closeBanner,
  lookup, clearSearch, onInput, selectSug, quickPick, renderStatsPanel,
  startGPS, searchPlacesByText, nearbyPick,
  refreshData,
  renderWallet, setWalletFilter, removeCard,
  openModal, closeModal, modalOverlayClick, filterCardOptions, toggleCardSelect, saveModalCards,
  openCustomModal, editCustomCard, closeCustomModal, customOverlayClick, toggleCustomCat, saveCustomCard,
  exportWallet, importWallet, clearTaps,
  openEditModal, closeEditModal, editOverlayClick, toggleEditCat, saveCardEdit, clearCardEdit,
});

// Service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type === 'DATA_REFRESHED') {
      import('./data.js').then(({ setDataStatus }) => {
        import('./state.js').then(({ state }) => setDataStatus('ok', state.DATA_META.lastUpdated));
      });
    }
  });
}

startClock();
startMascot();
initKeyboardHandlers();
initPWAInstall();
showOnboardingIfNew();
checkAutoRefresh();
initVisitorCount();

// Card-tap event delegation — single listener covers dynamically rendered results
document.getElementById('results').addEventListener('click', e => {
  const el = e.target.closest('.card-result[data-card]');
  if (el) logCardTap(el, el.dataset.card, el.dataset.cat, el.dataset.vendor);
});
document.getElementById('results').addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    const el = e.target.closest('.card-result[data-card]');
    if (el) { e.preventDefault(); logCardTap(el, el.dataset.card, el.dataset.cat, el.dataset.vendor); }
  }
});
