import { checkAutoRefresh, refreshData } from './data.js';
import { switchTab, showToast, openDisclaimer, closeDisclaimer, closeBanner, startClock, initKeyboardHandlers, initPWAInstall, showOnboardingIfNew } from './ui.js';
import { lookup, clearSearch, onInput, selectSug, quickPick } from './search.js';
import { startGPS, searchPlacesByText, nearbyPick } from './places.js';
import { renderWallet, setWalletFilter, removeCard, openModal, closeModal, modalOverlayClick, filterCardOptions, toggleCardSelect, saveModalCards, openCustomModal, editCustomCard, closeCustomModal, customOverlayClick, toggleCustomCat, saveCustomCard, exportWallet, importWallet } from './wallet.js';
import { openEditModal, closeEditModal, editOverlayClick, toggleEditCat, saveCardEdit, clearCardEdit } from './overrides.js';

// Expose all functions called from HTML onclick attributes
Object.assign(window, {
  switchTab, showToast, openDisclaimer, closeDisclaimer, closeBanner,
  lookup, clearSearch, onInput, selectSug, quickPick,
  startGPS, searchPlacesByText, nearbyPick,
  refreshData,
  renderWallet, setWalletFilter, removeCard,
  openModal, closeModal, modalOverlayClick, filterCardOptions, toggleCardSelect, saveModalCards,
  openCustomModal, editCustomCard, closeCustomModal, customOverlayClick, toggleCustomCat, saveCustomCard,
  exportWallet, importWallet,
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
initKeyboardHandlers();
initPWAInstall();
showOnboardingIfNew();
checkAutoRefresh();
