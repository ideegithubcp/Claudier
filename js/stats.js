import { state } from './state.js';
import { escHtml } from './ui.js';
import { findBestVendor } from './search.js';
import { allWalletCards } from './cards.js';
import { loadS } from './storage.js';

const MATRIX_CATS = [
  { cat: 'Dining',          icon: '🍽️', vendor: 'mcdonalds'   },
  { cat: 'Grocery',         icon: '🛒', vendor: 'publix'       },
  { cat: 'Gas',             icon: '⛽', vendor: 'shell'        },
  { cat: 'Travel',          icon: '✈️', vendor: 'delta'        },
  { cat: 'Streaming',       icon: '📺', vendor: 'netflix'      },
  { cat: 'Online Shopping', icon: '📦', vendor: 'amazon'       },
  { cat: 'Drugstore',       icon: '💊', vendor: 'cvs'          },
  { cat: 'Rideshare',       icon: '🚕', vendor: 'uber'         },
  { cat: 'Coffee',          icon: '☕', vendor: 'starbucks'    },
  { cat: 'Phone / Wireless',icon: '📱', vendor: 'att'          },
  { cat: 'Utilities',       icon: '⚡', vendor: 'duke energy'  },
  { cat: 'Entertainment',   icon: '🎬', vendor: 'amc'          },
];

function buildBestCatHTML() {
  const hasWallet = state.myCardIds.length > 0 || state.customCards.length > 0;
  const wallet = hasWallet ? allWalletCards() : [];
  const walletNames = hasWallet ? new Set(wallet.map(c => c.name)) : null;

  let h = `<div class="stats-section">
    <div class="stats-section-title">📊 Best Card Per Category</div>
    <div class="stats-sub">${hasWallet ? 'Your top-earning card for each spend category' : 'Add cards to MyWallet for personalized picks'}</div>
    <div class="matrix-grid">`;

  for (const { cat, icon, vendor } of MATRIX_CATS) {
    const entry = findBestVendor(vendor);
    if (!entry?.recs?.length) continue;
    const ownedRec = walletNames ? entry.recs.find(r => walletNames.has(r.card)) : null;
    const topRec = ownedRec || entry.recs[0];
    if (!topRec) continue;
    const owned = !!ownedRec || !hasWallet;
    h += `<div class="matrix-row${owned ? '' : ' matrix-dimmed'}">
      <div class="matrix-cat">${icon}<span>${escHtml(cat)}</span></div>
      <div class="matrix-info">
        <div class="matrix-card-name">${escHtml(topRec.card)}</div>
        <div class="matrix-earn">${escHtml(topRec.earn)}</div>
      </div>
      ${!owned ? '<div class="matrix-no-match">Not in wallet</div>' : ''}
    </div>`;
  }

  h += `</div></div>`;
  return h;
}

function buildUsageHTML() {
  const taps = loadS('sr_taps', []);
  if (!taps.length) {
    return `<div class="stats-section">
      <div class="stats-section-title">🎯 My Card Usage</div>
      <div class="stats-empty">Tap any card in search results to log which card you used — a usage matrix will appear here.</div>
    </div>`;
  }

  const map = {};
  for (const t of taps) {
    if (!t.cat || !t.card) continue;
    if (!map[t.cat]) map[t.cat] = {};
    map[t.cat][t.card] = (map[t.cat][t.card] || 0) + 1;
  }
  const cats  = Object.keys(map);
  const cards = [...new Set(taps.map(t => t.card).filter(Boolean))];
  if (!cats.length) return '';

  let h = `<div class="stats-section">
    <div class="stats-section-hdr">
      <div>
        <div class="stats-section-title">🎯 My Card Usage</div>
        <div class="stats-sub">${taps.length} tap${taps.length !== 1 ? 's' : ''} recorded</div>
      </div>
      <button class="usage-clear-btn" onclick="clearTaps()">Clear</button>
    </div>
    <div class="usage-scroll">
    <table class="usage-table">
      <thead><tr>
        <th class="usage-cat-th">Category</th>
        ${cards.map(c => `<th class="usage-card-th">${escHtml(c)}</th>`).join('')}
      </tr></thead>
      <tbody>`;

  for (const cat of cats) {
    h += `<tr><td class="usage-cat-td">${escHtml(cat)}</td>`;
    for (const card of cards) {
      const count = map[cat][card] || 0;
      h += count
        ? `<td class="usage-cell hit">${count}×</td>`
        : `<td class="usage-cell">—</td>`;
    }
    h += `</tr>`;
  }

  h += `</tbody></table></div></div>`;
  return h;
}

export function renderStatsPanel() {
  const body = document.getElementById('stats-body');
  if (!body) return;
  body.innerHTML = buildBestCatHTML() + buildUsageHTML();
}
