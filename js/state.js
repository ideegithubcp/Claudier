import { loadS } from './storage.js';

const _ids = loadS('sr_wallet', []);
export const state = {
  CARD_CATALOG: [],
  VENDOR_DB: [],
  DATA_META: {},
  myCardIds: _ids,
  customCards: loadS('sr_custom', []),
  cardOverrides: loadS('sr_card_overrides', {}),
  walletFilter: 'All',
  modalSelected: new Set(_ids),
  customCatSelection: new Set(),
  editingCustomId: null,
  editingCatalogId: null,
  editCatSelection: new Set(),
  toastTimer: null,
  deferredPrompt: null,
};
