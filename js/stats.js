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

// ── Spending profile ─────────────────────────────────────────────────────────

function parseEarnRate(earn) {
  const m = String(earn || '').match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function buildSpendingProfileHTML() {
  const taps = loadS('sr_taps', []);
  if (taps.length < 3) return '';

  // Count taps per category; track most-used vendor per category
  const catMap = {};
  for (const t of taps) {
    if (!t.cat) continue;
    if (!catMap[t.cat]) catMap[t.cat] = { count: 0, vendors: {} };
    catMap[t.cat].count++;
    if (t.vendor) catMap[t.cat].vendors[t.vendor] = (catMap[t.cat].vendors[t.vendor] || 0) + 1;
  }

  const topCats = Object.entries(catMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6);

  if (!topCats.length) return '';

  const hasWallet = state.myCardIds.length > 0 || state.customCards.length > 0;
  const wallet = hasWallet ? allWalletCards() : [];
  const walletNames = new Set(wallet.map(c => c.name));

  let rows = '';
  let rowCount = 0;

  for (const [cat, data] of topCats) {
    // Use most-tapped vendor to look up catalog recs for this category
    const topVendorKey = Object.entries(data.vendors)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    const entry = topVendorKey ? findBestVendor(topVendorKey) : null;

    const mcMeta = MATRIX_CATS.find(m => m.cat.toLowerCase() === cat.toLowerCase());
    const icon = mcMeta?.icon || '💳';

    const bestCatalogRec = entry?.recs?.[0] || null;
    const bestCatalogRate = bestCatalogRec ? parseEarnRate(bestCatalogRec.earn) : 0;

    let ownedRec = null;
    if (hasWallet && entry?.recs) {
      ownedRec = entry.recs.find(r => walletNames.has(r.card));
      if (!ownedRec) {
        const cc = wallet.find(c => c.custom && c.cats.some(x => x.toLowerCase() === (entry.cat || '').toLowerCase()));
        if (cc) ownedRec = { card: cc.name, earn: cc.earn };
      }
    }

    const ownedRate = ownedRec ? parseEarnRate(ownedRec.earn) : 0;

    let badge, badgeClass, gapTip = '';
    if (!hasWallet || !ownedRec) {
      if (!bestCatalogRec) continue;
      badge = '➕ No card yet'; badgeClass = 'neutral';
      gapTip = `Best available: ${bestCatalogRec.card} — ${bestCatalogRec.earn}`;
    } else if (ownedRate >= bestCatalogRate * 0.85) {
      badge = '✅ Optimized'; badgeClass = 'good';
    } else if (ownedRate >= 2) {
      badge = '🟡 Decent'; badgeClass = 'ok';
      if (bestCatalogRec && bestCatalogRate > ownedRate + 0.9) {
        gapTip = `${bestCatalogRec.card} earns ${bestCatalogRec.earn}`;
      }
    } else {
      badge = '⚠️ Gap'; badgeClass = 'warn';
      if (bestCatalogRec) gapTip = `Consider: ${bestCatalogRec.card} — ${bestCatalogRec.earn}`;
    }

    rowCount++;
    rows += `<div class="profile-row">
      <div class="profile-row-top">
        <div class="profile-cat-label">
          <span class="profile-icon">${icon}</span>
          <span class="profile-cat-name">${escHtml(cat)}</span>
          <span class="profile-taps">${data.count}×</span>
        </div>
        <span class="profile-badge ${badgeClass}">${badge}</span>
      </div>
      ${ownedRec ? `<div class="profile-card-line">
        <span class="profile-card-name">${escHtml(ownedRec.card)}</span>
        <span class="profile-card-earn">${escHtml(ownedRec.earn)}</span>
      </div>` : ''}
      ${gapTip ? `<div class="profile-gap-tip">→ ${escHtml(gapTip)}</div>` : ''}
    </div>`;
  }

  if (!rowCount) return '';

  return `<div class="stats-section">
    <div class="stats-section-title">🏆 Your Spending Profile</div>
    <div class="stats-sub">Your most-searched categories and how well your wallet covers them</div>
    <div class="profile-list">${rows}</div>
  </div>`;
}

export function renderStatsPanel() {
  const body = document.getElementById('stats-body');
  if (!body) return;
  body.innerHTML = buildBestCatHTML() + buildSpendingProfileHTML() + buildUsageHTML();
}
