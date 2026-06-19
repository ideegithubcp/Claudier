import { state } from './state.js';
import { saveS } from './storage.js';
import { showToast } from './ui.js';
import { renderWallet } from './wallet.js';

const CC_CATS_EDIT = ['Dining', 'Grocery', 'Gas', 'Travel', 'Streaming', 'Utilities', 'Wireless', 'Shopping', 'Drugstore', 'Entertainment', 'Rent', 'Catch-all', 'Balance Transfer', 'Other'];

export function openEditModal(cardId) {
  const c = state.CARD_CATALOG.find(x => x.id === cardId); if (!c) return;
  state.editingCatalogId = cardId;
  const ov = state.cardOverrides[cardId] || {};
  document.getElementById('edit-modal-title').textContent = c.name;
  document.getElementById('edit-af').value = ov.af !== undefined ? ov.af : '';
  document.getElementById('edit-af-hint').textContent = 'Catalog value: $' + c.af + '/yr';
  document.getElementById('edit-earn').value = ov.earn || '';
  document.getElementById('edit-earn-hint').textContent = 'Catalog: ' + (c.tip || '').slice(0, 80) + (c.tip?.length > 80 ? '…' : '');
  document.getElementById('edit-tip').value = ov.tip || '';
  state.editCatSelection = new Set(ov.cats?.length ? ov.cats : c.cats);
  buildEditCatToggles();
  document.getElementById('edit-overlay').classList.add('show');
  setTimeout(() => document.getElementById('edit-af').focus(), 200);
}

export function closeEditModal() {
  document.getElementById('edit-overlay').classList.remove('show');
  state.editingCatalogId = null;
}

export function editOverlayClick(e) { if (e.target === document.getElementById('edit-overlay')) closeEditModal(); }

export function buildEditCatToggles() {
  document.getElementById('edit-cats').innerHTML = CC_CATS_EDIT.map(c => `
    <div class="cat-toggle ${state.editCatSelection.has(c) ? 'on' : ''}" onclick="toggleEditCat('${c}')" id="ecat-${c}">${c}</div>`).join('');
}

export function toggleEditCat(c) {
  if (state.editCatSelection.has(c)) state.editCatSelection.delete(c); else state.editCatSelection.add(c);
  const el = document.getElementById('ecat-' + c);
  if (el) el.className = 'cat-toggle' + (state.editCatSelection.has(c) ? ' on' : '');
}

export function saveCardEdit() {
  if (!state.editingCatalogId) return;
  const afRaw = document.getElementById('edit-af').value.trim();
  const earn = document.getElementById('edit-earn').value.trim();
  const tip = document.getElementById('edit-tip').value.trim();
  const cats = [...state.editCatSelection];
  const ov = {};
  if (afRaw !== '') ov.af = parseFloat(afRaw) || 0;
  if (earn) ov.earn = earn;
  if (tip) ov.tip = tip;
  if (cats.length) ov.cats = cats;
  if (Object.keys(ov).length === 0) delete state.cardOverrides[state.editingCatalogId];
  else state.cardOverrides[state.editingCatalogId] = ov;
  saveS('sr_card_overrides', state.cardOverrides);
  closeEditModal(); renderWallet();
  showToast('✓ Card overrides saved', 'success');
}

export function clearCardEdit() {
  if (!state.editingCatalogId) return;
  delete state.cardOverrides[state.editingCatalogId];
  saveS('sr_card_overrides', state.cardOverrides);
  closeEditModal(); renderWallet();
  showToast('Card reset to catalog defaults');
}
