import { state } from './state.js';
import { saveS } from './storage.js';
import { showToast, escHtml, escAttr } from './ui.js';
import { fuzzyScore, norm } from './search.js';

export const WALLET_FILTERS = ['All', 'No Fee', 'Dining', 'Gas', 'Grocery', 'Streaming', 'Utilities', 'Travel', 'Shopping'];
export const CC_CATS = ['Dining', 'Grocery', 'Gas', 'Travel', 'Streaming', 'Utilities', 'Wireless', 'Shopping', 'Drugstore', 'Entertainment', 'Rent', 'Catch-all', 'Balance Transfer', 'Other'];

export function applyOverrides(c) {
  const ov = state.cardOverrides[c.id];
  if (!ov) return c;
  return { ...c, af: ov.af !== undefined ? ov.af : c.af, tip: ov.tip || c.tip, cats: ov.cats?.length ? ov.cats : c.cats, earn: ov.earn || c.earn, _hasOverride: true };
}

export function allWalletCards() {
  const catalog = state.CARD_CATALOG.filter(c => state.myCardIds.includes(c.id)).map(applyOverrides);
  return [...catalog, ...state.customCards];
}

export function getCardTip(c) {
  const ov = state.cardOverrides[c.id];
  return ov?.tip || c.tip || ov?.earn || c.earn || '';
}

export function updateWalletBadge() {
  const total = state.myCardIds.length + state.customCards.length;
  const badge = document.getElementById('wallet-badge');
  if (total > 0) { badge.style.display = 'block'; badge.textContent = total; } else { badge.style.display = 'none'; }
}

export function renderWallet() {
  const body = document.getElementById('wallet-body');
  const owned = allWalletCards();
  if (owned.length === 0) {
    body.innerHTML = `<div class="wallet-empty">
      <div class="big-ico">💳</div>
      <h3>Set up your wallet</h3>
      <p>Tell SwipeRight which cards you own so recommendations are personalized to your wallet only.</p>
      <button class="wallet-add-btn" onclick="openModal()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
        Add my cards
      </button>
    </div>`;
    updateWalletBadge(); return;
  }
  const totalAF = owned.reduce((s, c) => s + (c.af || 0), 0);
  const noFee = owned.filter(c => !c.af).length;
  let html = `<div class="wallet-stats-row">
    <div class="ws-tile"><div class="ws-val">${owned.length}</div><div class="ws-lbl">Cards</div></div>
    <div class="ws-tile"><div class="ws-val">${noFee}</div><div class="ws-lbl">No annual fee</div></div>
    <div class="ws-tile"><div class="ws-val">$${totalAF}</div><div class="ws-lbl">Annual fees</div></div>
  </div>
  <div class="filter-row">`;
  WALLET_FILTERS.forEach(f => { html += `<div class="chip ${f === state.walletFilter ? 'on' : ''}" onclick="setWalletFilter('${f}')">${f}</div>`; });
  html += `</div><div class="wallet-actions">
    <div class="wact-btn wact-add" onclick="openModal()" role="button">+ From catalog</div>
    <div class="wact-btn wact-custom" onclick="openCustomModal()" role="button">✏ Custom card</div>
    <div class="wact-btn wact-export" onclick="exportWallet()" role="button">⬇ Export</div>
    <div class="wact-btn wact-import" onclick="document.getElementById('import-file').click()" role="button">⬆ Import</div>
  </div>`;
  const ff = {
    'All': () => true, 'No Fee': c => !c.af,
    'Dining': c => c.cats.some(x => /dining|restaurant|food/i.test(x)),
    'Gas': c => c.cats.some(x => /gas/i.test(x)),
    'Grocery': c => c.cats.some(x => /grocery|supermarket/i.test(x)),
    'Streaming': c => c.cats.some(x => /streaming/i.test(x)),
    'Utilities': c => c.cats.some(x => /util/i.test(x)),
    'Travel': c => c.cats.some(x => /travel|airline|hotel|rent/i.test(x)),
    'Shopping': c => c.cats.some(x => /shop|retail|amazon/i.test(x)),
  };
  const filtered = owned.filter(ff[state.walletFilter] || ff['All']);
  html += `<div class="my-cards">`;
  if (!filtered.length) html += `<div style="text-align:center;padding:2rem;color:var(--muted);font-size:13px;">No cards match this filter.</div>`;
  filtered.forEach(c => {
    const isCustom = !!c.custom;
    html += `<div class="my-card-item" role="listitem">
      <div class="mc-header">
        <div class="mc-dot" style="background:${c.color || '#8A8FA8'}"></div>
        <div class="mc-name">${escHtml(c.name)}</div>
        ${isCustom ? '<span class="mc-custom-badge">Custom</span>' : ''}
        <div class="mc-af">${c.af ? '$' + c.af + '/yr' : 'No fee'}</div>
        <button class="mc-edit" onclick="${isCustom ? `editCustomCard('${c.id}')` : `openEditModal('${c.id}')`}" aria-label="Edit ${c.name}">✏</button>
        <button class="mc-remove" onclick="removeCard('${c.id}','${isCustom ? 'custom' : 'catalog'}')" aria-label="Remove ${c.name}">×</button>
      </div>
      <div class="mc-cats">${(c.cats || []).map(x => `<span class="mc-cat">${escHtml(x)}</span>`).join('')}</div>
      <div class="mc-tip">
        ${state.cardOverrides[c.id]?.earn ? '<span style="font-size:10px;color:var(--accent2);background:rgba(123,110,246,.12);padding:2px 7px;border-radius:99px;margin-bottom:5px;display:inline-block;">✏ Edited</span><br>' : ''}
        ${escHtml(getCardTip(c))}
      </div>
    </div>`;
  });
  html += `</div>`;
  body.innerHTML = html;
  updateWalletBadge();
}

export function setWalletFilter(f) { state.walletFilter = f; renderWallet(); }

export function removeCard(id, type) {
  if (type === 'custom') { state.customCards = state.customCards.filter(c => c.id !== id); saveS('sr_custom', state.customCards); }
  else { state.myCardIds = state.myCardIds.filter(x => x !== id); saveS('sr_wallet', state.myCardIds); state.modalSelected = new Set(state.myCardIds); }
  renderWallet();
  showToast('Card removed');
}

export function openModal() {
  state.modalSelected = new Set(state.myCardIds);
  document.getElementById('modal-search-input').value = '';
  renderCardOptions('');
  document.getElementById('modal-overlay').classList.add('show');
  setTimeout(() => document.getElementById('modal-search-input').focus(), 200);
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
}

export function modalOverlayClick(e) { if (e.target === document.getElementById('modal-overlay')) closeModal(); }

export function renderCardOptions(q) {
  const nq = norm(q);
  const filtered = state.CARD_CATALOG.filter(c =>
    nq === '' || norm(c.name).includes(nq) || norm(c.issuer).includes(nq) ||
    c.cats.some(x => norm(x).includes(nq)) || fuzzyScore(q, c.name) > 0.5
  );
  const groups = {};
  filtered.forEach(c => { if (!groups[c.issuer]) groups[c.issuer] = []; groups[c.issuer].push(c); });
  let html = '';
  Object.entries(groups).forEach(([issuer, cards]) => {
    html += `<div class="issuer-label">${escHtml(issuer)}</div>`;
    cards.forEach(c => {
      html += `<div class="card-option" onclick="toggleCardSelect('${c.id}')" role="option" aria-selected="${state.modalSelected.has(c.id)}">
        <div class="card-opt-dot" style="background:${c.color}"></div>
        <div class="card-opt-body">
          <div class="card-opt-name">${escHtml(c.name)}</div>
          <div class="card-opt-cats">${c.cats.join(' · ')}</div>
        </div>
        <div class="card-opt-af">${c.af ? '$' + c.af + '/yr' : 'No fee'}</div>
        <div class="card-opt-check ${state.modalSelected.has(c.id) ? 'checked' : ''}" id="chk-${c.id}"></div>
      </div>`;
    });
  });
  if (!html) html = '<div style="text-align:center;padding:2rem;color:var(--muted);font-size:13px;">No cards found. Try a different search or add a custom card.</div>';
  document.getElementById('card-option-list').innerHTML = html;
}

export function filterCardOptions() { renderCardOptions(document.getElementById('modal-search-input').value.trim()); }

export function toggleCardSelect(id) {
  if (state.modalSelected.has(id)) state.modalSelected.delete(id); else state.modalSelected.add(id);
  const chk = document.getElementById('chk-' + id);
  if (chk) { chk.className = 'card-opt-check' + (state.modalSelected.has(id) ? ' checked' : ''); chk.parentElement.setAttribute('aria-selected', state.modalSelected.has(id)); }
}

export function saveModalCards() {
  state.myCardIds = [...state.modalSelected];
  saveS('sr_wallet', state.myCardIds);
  closeModal(); renderWallet();
  const v = document.getElementById('vendorInput').value.trim();
  if (v && document.getElementById('results').innerHTML) {
    import('./search.js').then(({ renderResults, findBestVendor }) => renderResults(v, findBestVendor(v)));
  }
  showToast(`✓ Wallet updated — ${state.myCardIds.length} cards`, 'success');
}

export function openCustomModal(prefill) {
  state.editingCustomId = null;
  document.getElementById('custom-modal-title').textContent = 'Add a custom card';
  document.getElementById('cc-name').value = prefill || '';
  document.getElementById('cc-issuer').value = '';
  document.getElementById('cc-af').value = '0';
  document.getElementById('cc-network').value = 'Visa';
  document.getElementById('cc-earn').value = '';
  document.getElementById('cc-tip').value = '';
  state.customCatSelection = new Set();
  buildCatToggles();
  clearCustomErrors();
  document.getElementById('custom-overlay').classList.add('show');
  setTimeout(() => document.getElementById('cc-name').focus(), 200);
}

export function editCustomCard(id) {
  const cc = state.customCards.find(c => c.id === id); if (!cc) return;
  state.editingCustomId = id;
  document.getElementById('custom-modal-title').textContent = 'Edit card';
  document.getElementById('cc-name').value = cc.name;
  document.getElementById('cc-issuer').value = cc.issuer || '';
  document.getElementById('cc-af').value = cc.af || 0;
  document.getElementById('cc-network').value = cc.network || 'Visa';
  document.getElementById('cc-earn').value = cc.earn || '';
  document.getElementById('cc-tip').value = cc.tip || '';
  state.customCatSelection = new Set(cc.cats || []);
  buildCatToggles(); clearCustomErrors();
  document.getElementById('custom-overlay').classList.add('show');
}

export function closeCustomModal() { document.getElementById('custom-overlay').classList.remove('show'); state.editingCustomId = null; }
export function customOverlayClick(e) { if (e.target === document.getElementById('custom-overlay')) closeCustomModal(); }

export function buildCatToggles() {
  document.getElementById('cc-cats').innerHTML = CC_CATS.map(c => `
    <div class="cat-toggle ${state.customCatSelection.has(c) ? 'on' : ''}" onclick="toggleCustomCat('${c}')" id="ccat-${c}" role="checkbox" aria-checked="${state.customCatSelection.has(c)}">${c}</div>`).join('');
}

export function toggleCustomCat(c) {
  if (state.customCatSelection.has(c)) state.customCatSelection.delete(c); else state.customCatSelection.add(c);
  const el = document.getElementById('ccat-' + c);
  if (el) { el.className = 'cat-toggle' + (state.customCatSelection.has(c) ? ' on' : ''); el.setAttribute('aria-checked', state.customCatSelection.has(c)); }
}

export function clearCustomErrors() {
  ['cc-name', 'cc-earn'].forEach(id => document.getElementById(id).classList.remove('err'));
  ['err-cc-name', 'err-cc-earn'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('show'); });
}

export function saveCustomCard() {
  clearCustomErrors();
  const name = document.getElementById('cc-name').value.trim();
  const earn = document.getElementById('cc-earn').value.trim();
  let valid = true;
  if (!name) { document.getElementById('cc-name').classList.add('err'); document.getElementById('err-cc-name').classList.add('show'); document.getElementById('cc-name').focus(); valid = false; }
  if (!earn) { document.getElementById('cc-earn').classList.add('err'); document.getElementById('err-cc-earn').classList.add('show'); if (valid) document.getElementById('cc-earn').focus(); valid = false; }
  if (!valid) return;
  const card = {
    id: state.editingCustomId || ('custom_' + Date.now()),
    name, issuer: document.getElementById('cc-issuer').value.trim() || 'Custom',
    af: parseFloat(document.getElementById('cc-af').value) || 0,
    network: document.getElementById('cc-network').value,
    cats: [...state.customCatSelection], earn,
    tip: document.getElementById('cc-tip').value.trim() || earn,
    color: '#7B6EF6', custom: true,
  };
  if (state.editingCustomId) state.customCards = state.customCards.map(c => c.id === state.editingCustomId ? card : c);
  else state.customCards.unshift(card);
  saveS('sr_custom', state.customCards);
  closeCustomModal(); renderWallet();
  showToast(state.editingCustomId ? '✓ Card updated' : '✓ Custom card added', 'success');
}

export function exportWallet() {
  const payload = { version: '1.0', exportedAt: new Date().toISOString(), myCardIds: state.myCardIds, customCards: state.customCards, disclaimer: 'SwipeRight wallet backup.' };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `swiperight-wallet-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('✓ Wallet exported', 'success');
}

export function importWallet(e) {
  const file = e.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.myCardIds || !Array.isArray(data.myCardIds)) throw new Error('Invalid format');
      const confirmed = confirm(`Import wallet with ${data.myCardIds.length} catalog cards and ${(data.customCards || []).length} custom cards? This will replace your current wallet.`);
      if (!confirmed) return;
      state.myCardIds = data.myCardIds;
      state.customCards = data.customCards || [];
      saveS('sr_wallet', state.myCardIds);
      saveS('sr_custom', state.customCards);
      state.modalSelected = new Set(state.myCardIds);
      renderWallet();
      showToast(`✓ Imported ${state.myCardIds.length + state.customCards.length} cards`, 'success');
    } catch { showToast('Invalid wallet file', 'error'); }
  };
  reader.readAsText(file);
  e.target.value = '';
}
