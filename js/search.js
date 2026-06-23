import { state } from './state.js';
import { escHtml, escAttr, switchTab } from './ui.js';
import { allWalletCards } from './cards.js';

export function norm(s) { return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim(); }

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    i === 0 ? Array.from({ length: b.length + 1 }, (_, j) => j) : [i, ...new Array(b.length).fill(0)]
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function trigrams(s) {
  const t = new Set(); const p = '  ' + s + '  ';
  for (let i = 0; i < p.length - 2; i++) t.add(p.slice(i, i + 3));
  return t;
}

function trigramSim(a, b) {
  const ta = trigrams(a), tb = trigrams(b);
  let intersect = 0;
  for (const g of ta) if (tb.has(g)) intersect++;
  return (2 * intersect) / (ta.size + tb.size || 1);
}

export function fuzzyScore(query, candidate) {
  const q = norm(query), c = norm(candidate);
  if (!q || !c) return 0;
  if (c === q) return 1.0;
  if (c.startsWith(q) || q.startsWith(c)) return 0.95;
  if (c.includes(q) || q.includes(c)) return 0.85;
  const qWords = q.split(/\s+/), cWords = c.split(/\s+/);
  if (qWords.some(w => cWords.some(cw => cw.startsWith(w) || w.startsWith(cw)))) return 0.75;
  const tSim = trigramSim(q, c);
  if (tSim > 0.4) return tSim * 0.8;
  if (q.length <= 8) {
    const lev = levenshtein(q, c.slice(0, q.length + 4));
    const levSim = 1 - lev / Math.max(q.length, c.length);
    if (levSim > 0.5) return levSim * 0.7;
  }
  return 0;
}

export function searchVendors(query) {
  if (!query || query.length < 2) return [];
  const results = [];
  for (const entry of state.VENDOR_DB) {
    let best = 0;
    for (const name of entry.names) {
      const score = fuzzyScore(query, name);
      if (score > best) best = score;
    }
    if (best > 0.35) results.push({ entry, score: best });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 8);
}

export function findBestVendor(query) {
  const results = searchVendors(query);
  return results.length > 0 ? results[0].entry : null;
}

function recHTML(rank, r, isBest, inWallet, walletNames) {
  const owned = walletNames === null || walletNames.has(r.card);
  const notOwned = walletNames !== null && !owned;
  const rankClass = rank === 1 ? 'r1' : rank === 2 ? 'r2' : rank === 3 ? 'r3' : 'rX';
  return `<div class="card-result ${isBest && inWallet ? 'best' : ''} ${notOwned ? 'dimmed' : ''}" role="option" aria-selected="${isBest ? 'true' : 'false'}">
    <div class="rank-c ${rankClass}">${rank || '—'}</div>
    <div>
      <div class="res-name">${escHtml(r.card)}${isBest && inWallet ? '<span class="best-badge">Best pick</span>' : ''}</div>
      <div class="res-earn">→ ${escHtml(r.earn)}</div>
      <div class="res-why">${escHtml(r.why)}</div>
      ${notOwned ? '<div class="not-owned">⚠ Not in your wallet</div>' : ''}
    </div>
  </div>`;
}

export function renderResults(vendor, entry) {
  const res = document.getElementById('results');
  if (!entry) {
    res.innerHTML = `<div class="no-res">No match for "<strong>${escHtml(vendor)}</strong>"<br><span style="font-size:12px;color:var(--muted)">Try: Publix, CVS, Shell, Amazon, Netflix…</span></div>`;
    return;
  }
  const hasWallet = state.myCardIds.length > 0 || state.customCards.length > 0;
  // Pre-compute owned card names once — avoids O(n²) repeated allWalletCards() calls
  const wallet = hasWallet ? allWalletCards() : [];
  const walletNames = hasWallet ? new Set(wallet.map(c => c.name)) : null;

  let h = `<div class="results-hdr">Best cards for <strong>${escHtml(entry.names[0])}</strong> <span style="font-size:11px;color:var(--muted)">(${entry.cat})</span></div>`;
  if (hasWallet) h += `<div class="wallet-note">★ Ranked for your wallet — unowned cards shown dimmed below</div>`;

  const shown = new Set(); let rank = 0;
  for (const r of entry.recs) {
    if (walletNames && !walletNames.has(r.card)) continue;
    rank++; shown.add(r.card); h += recHTML(rank, r, rank === 1, true, walletNames);
  }
  for (const cc of state.customCards) {
    if (shown.has(cc.name)) continue;
    if (cc.cats.some(c => c.toLowerCase() === entry.cat.toLowerCase())) {
      rank++; shown.add(cc.name);
      h += recHTML(rank, { card: cc.name, earn: cc.earn, why: 'Your custom card' }, rank === 1, true, walletNames);
    }
  }
  if (hasWallet) {
    for (const r of entry.recs) { if (shown.has(r.card)) continue; h += recHTML(null, r, false, false, walletNames); }
  } else {
    for (const r of entry.recs) { if (shown.has(r.card)) continue; rank++; h += recHTML(rank, r, rank === 1, true, null); }
  }
  h += `<div class="tip-box">💡 Verify category coding on your first statement — some merchants code unexpectedly. <button onclick="openDisclaimer()" style="background:none;border:none;color:var(--gold);text-decoration:underline;cursor:pointer;font-size:12px;padding:0;">Full disclaimer →</button></div>`;
  res.innerHTML = h;
  document.getElementById('back-search').classList.add('show');
  document.getElementById('search-wrap').style.display = 'none';
}

export function lookup() {
  const v = document.getElementById('vendorInput').value.trim();
  if (!v) return;
  document.getElementById('suggestions').style.display = 'none';
  renderResults(v, findBestVendor(v));
}

export function clearSearch() {
  document.getElementById('vendorInput').value = '';
  document.getElementById('results').innerHTML = '';
  document.getElementById('back-search').classList.remove('show');
  document.getElementById('search-wrap').style.display = '';
  document.getElementById('suggestions').style.display = 'none';
  document.getElementById('vendorInput').focus();
}

let _inputTimer;
export function onInput() {
  clearTimeout(_inputTimer);
  _inputTimer = setTimeout(() => {
    const v = document.getElementById('vendorInput').value.trim();
    const sugg = document.getElementById('suggestions');
    if (v.length < 2) { sugg.style.display = 'none'; return; }
    const results = searchVendors(v);
    if (!results.length) { sugg.style.display = 'none'; return; }
    sugg.innerHTML = results.map(({ entry, score }) => `
      <div class="sug" onclick="selectSug('${escAttr(entry.names[0])}')" role="option">
        <span>${entry.names[0].charAt(0).toUpperCase() + entry.names[0].slice(1)}</span>
        <div class="sug-meta">
          <span class="sug-cat">${entry.cat}</span>
          ${score < 0.85 ? '<span class="sug-score">~match</span>' : ''}
        </div>
      </div>`).join('');
    sugg.style.display = 'block';
  }, 150);
}

export function selectSug(name) {
  document.getElementById('vendorInput').value = name.charAt(0).toUpperCase() + name.slice(1);
  document.getElementById('suggestions').style.display = 'none';
  lookup();
}

const QUICK_SPOTS = [
  { icon: '🛒', name: 'Grocery store', sub: 'Publix, Walmart…', vendor: 'publix' },
  { icon: '⛽', name: 'Gas station', sub: 'Shell, Exxon…', vendor: 'shell' },
  { icon: '🍔', name: 'Fast food', sub: "McDonald's, Taco Bell…", vendor: "mcdonald's" },
  { icon: '☕', name: 'Coffee', sub: 'Starbucks, Dunkin…', vendor: 'starbucks' },
  { icon: '💊', name: 'Pharmacy', sub: 'CVS, Walgreens…', vendor: 'cvs' },
  { icon: '📦', name: 'Amazon', sub: 'Amazon.com', vendor: 'amazon' },
];
const QUICK_BILLS = [
  { icon: '📺', name: 'Streaming', sub: 'Netflix, Hulu…', vendor: 'netflix' },
  { icon: '📱', name: 'Phone bill', sub: 'AT&T, T-Mobile…', vendor: 'at&t' },
  { icon: '⚡', name: 'Utility bill', sub: 'Electric, water…', vendor: 'duke energy' },
  { icon: '🚕', name: 'Rideshare', sub: 'Uber, Lyft…', vendor: 'uber' },
];

export function buildQuick() {
  const wallet = allWalletCards();
  const walletNames = new Set(wallet.map(c => c.name));

  function bestEarn(vendorKey) {
    const entry = findBestVendor(vendorKey);
    if (!entry?.recs?.length) return '';
    // Show best card the user owns; fall back to catalog's top pick
    const match = wallet.length
      ? entry.recs.find(r => walletNames.has(r.card))
      : null;
    const rec = match || entry.recs[0];
    return rec ? rec.earn : '';
  }

  document.getElementById('qt-grid').innerHTML = QUICK_SPOTS.map(s => `
    <button class="qt-btn" onclick="quickPick('${escAttr(s.vendor)}','${escAttr(s.name)}')">
      <span class="qt-icon">${s.icon}</span><div class="qt-name">${escHtml(s.name)}</div>
      <div class="qt-sub">${escHtml(s.sub)}</div><div class="qt-earn">${escHtml(bestEarn(s.vendor))}</div>
    </button>`).join('');
  document.getElementById('qt-grid2').innerHTML = QUICK_BILLS.map(s => `
    <button class="qt-btn" onclick="quickPick('${escAttr(s.vendor)}','${escAttr(s.name)}')">
      <span class="qt-icon">${s.icon}</span><div class="qt-name">${escHtml(s.name)}</div>
      <div class="qt-sub">${escHtml(s.sub)}</div><div class="qt-earn">${escHtml(bestEarn(s.vendor))}</div>
    </button>`).join('');
}

export function quickPick(v, d) {
  switchTab('search');
  document.getElementById('vendorInput').value = d;
  renderResults(d, findBestVendor(v));
}
