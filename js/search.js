import { state } from './state.js';
import { escHtml, escAttr, escJs, switchTab, haptic } from './ui.js';
import { loadS, saveS } from './storage.js';
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

function recHTML(rank, r, isBest, inWallet, walletNames, cat = '', vendor = '') {
  const owned = walletNames === null || walletNames.has(r.card);
  const notOwned = walletNames !== null && !owned;
  const rankClass = rank === 1 ? 'r1' : rank === 2 ? 'r2' : rank === 3 ? 'r3' : 'rX';
  return `<div class="card-result ${isBest && inWallet ? 'best' : ''} ${notOwned ? 'dimmed' : ''}"
    role="button" tabindex="0" aria-label="Log ${escAttr(r.card)}"
    data-card="${escAttr(r.card)}" data-cat="${escAttr(cat)}" data-vendor="${escAttr(vendor)}">
    <div class="rank-c ${rankClass}">${rank || '—'}</div>
    <div style="flex:1;min-width:0;">
      <div class="res-name">${escHtml(r.card)}${isBest && inWallet ? '<span class="best-badge">Best pick</span>' : ''}</div>
      <div class="res-earn">→ ${escHtml(r.earn)}</div>
      <div class="res-why">${escHtml(r.why)}</div>
      ${notOwned ? '<div class="not-owned">⚠ Not in your wallet</div>' : ''}
    </div>
    <div class="tap-hint">Tap to log →</div>
  </div>`;
}

export function logCardTap(el, card, cat, vendor) {
  haptic(15);
  el.classList.add('card-tapped');
  setTimeout(() => el.classList.remove('card-tapped'), 1800);
  let taps = loadS('sr_taps', []);
  taps.unshift({ card, cat, vendor, ts: Date.now() });
  saveS('sr_taps', taps.slice(0, 500));
  // Import showToast lazily to avoid circular at module init
  import('./ui.js').then(({ showToast }) => showToast(`✓ ${card} logged for ${cat || vendor}`, 'success'));
}

// ── Recent searches ────────────────────────────────────────────────────────

const MAX_RECENT = 8;

function addRecent(display, key) {
  let recent = loadS('sr_recent', []);
  recent = recent.filter(r => r.key !== key);
  recent.unshift({ display, key });
  saveS('sr_recent', recent.slice(0, MAX_RECENT));
  renderRecent();
}

export function renderRecent() {
  const recent = loadS('sr_recent', []);
  const section = document.getElementById('recent-section');
  const row = document.getElementById('recent-row');
  if (!section || !row) return;
  if (!recent.length) { section.style.display = 'none'; return; }
  row.innerHTML = recent.map(r =>
    `<button class="recent-chip" onclick="quickPick('${escJs(r.key)}','${escJs(r.display)}')">${escHtml(r.display)}</button>`
  ).join('');
  section.style.display = '';
}

function quickHeroHTML(card, earn, cat, vendor) {
  return `<div class="quick-hero" data-card="${escAttr(card)}" data-cat="${escAttr(cat)}" data-vendor="${escAttr(vendor)}" role="button" tabindex="0" aria-label="Log ${escAttr(card)}">
    <div class="qh-eyebrow">✅ Use this card</div>
    <div class="qh-card">${escHtml(card)}</div>
    <div class="qh-earn">${escHtml(earn)}</div>
    <div class="qh-foot">Tap to log this card →</div>
  </div>
  <div class="results-divider">All options</div>`;
}

// ── Generic-category fallback ──────────────────────────────────────────────

const CATCH_ALL_RECS = [
  { card: 'Citi Double Cash',       earn: '2% cash back',   why: 'Best flat-rate — 2% on every purchase with no category restrictions' },
  { card: 'Wells Fargo Active Cash', earn: '2% cash back',  why: 'Unlimited 2% on all purchases, no annual fee' },
  { card: 'Alliant Cashback Visa',  earn: '2.5% cash back', why: 'Highest flat-rate available (Alliant CU membership required)' },
  { card: 'Chase Freedom Unlimited', earn: '1.5% cash back', why: 'Solid flat-rate — pairs with Sapphire Reserve for point transfers' },
];

const GENERIC_CATS = [
  {
    match: /insur|allstate|geico|progressive|state.?farm|safeco|nationwide|liberty.?mutual|farmers|policy|coverage.*(bill|pay)/i,
    cat: 'Insurance / Financial', icon: '🛡️',
    recs: CATCH_ALL_RECS,
    tip: 'Insurance premiums almost always code as Miscellaneous or Financial Services — no bonus category covers them. Use your best flat-rate card.',
  },
  {
    match: /hospital|clinic|doctor|dentist|dental|medical|health.?care|urgent.?care|optom|eye.?care|vision|therap|physician|radiol|orthop|emerg.*room/i,
    cat: 'Medical / Healthcare', icon: '🏥',
    recs: CATCH_ALL_RECS,
    tip: 'Healthcare payments rarely earn bonus points. Some cards have FSA/HSA compatibility — check if you have a dedicated health card.',
  },
  {
    match: /hotel|motel|resort|lodge|airbnb|vrbo|marriott|hilton|hyatt|ihg|wyndham|holiday.?inn|hampton.?inn|sheraton|westin|four.?seasons|ritz|bed.?and.?break/i,
    cat: 'Hotels / Lodging', icon: '🏨',
    recs: [
      { card: 'Chase Sapphire Reserve', earn: '4x on hotels booked direct', why: 'Best hotel multiplier + $300 annual travel credit' },
      { card: 'Amex Platinum',          earn: '5x via Amex Travel portal',   why: '5x on hotels booked through amextravel.com' },
      { card: 'Capital One Venture X',  earn: '10x via CapOne Travel',       why: '10x on hotels booked through Capital One Travel' },
      { card: 'Chase Sapphire Preferred', earn: '2x on travel',              why: 'Entry-level travel card — 2x on all hotels' },
    ],
    tip: 'Book directly with the hotel or through your card\'s travel portal for maximum points. OTAs like Expedia often earn lower rates.',
  },
  {
    match: /airline|flight|airport|delta|united.?airlines|southwest|jetblue|american.?air|alaska.?air|spirit.?air|frontier.?air|lufthansa|british.?airways|air.?canada/i,
    cat: 'Airlines / Flights', icon: '✈️',
    recs: [
      { card: 'Amex Platinum',          earn: '5x on flights booked direct',  why: 'Best airline card — 5x on direct or Amex Travel flights + lounge access' },
      { card: 'Chase Sapphire Reserve', earn: '4x on flights booked direct',  why: '4x on flights + Priority Pass lounge access' },
      { card: 'Citi Strata Premier',    earn: '3x on air travel',             why: '3x on all airlines with transferable ThankYou points' },
      { card: 'Chase Sapphire Preferred', earn: '2x on travel',               why: 'Entry travel card — 2x on all flights' },
    ],
    tip: 'Book directly with the airline (not via an OTA) for maximum bonus points. Some cards also offer bonus rates via their own travel portal.',
  },
  {
    match: /car.?rental|rent.?a.?car|hertz|enterprise|avis|budget.?car|national.?car|alamo|sixt|turo/i,
    cat: 'Car Rental', icon: '🚗',
    recs: [
      { card: 'Chase Sapphire Reserve', earn: '3x on travel', why: 'Car rentals code as travel + primary CDW insurance included — skip the rental counter upsell' },
      { card: 'Capital One Venture X',  earn: '5x via CapOne Travel',         why: '5x when booked through Capital One Travel portal' },
      { card: 'Chase Sapphire Preferred', earn: '2x on travel',               why: '2x on rentals + secondary CDW coverage' },
    ],
    tip: 'Use a card with primary rental CDW (Chase Sapphire Reserve) to decline the rental company\'s expensive insurance add-on.',
  },
  {
    match: /gym|fitness|planet.?fitness|gold.?s.?gym|la.?fitness|equinox|crossfit|yoga|orange.?theory|peloton|anytime.?fitness|snap.?fitness/i,
    cat: 'Gym / Fitness', icon: '🏋️',
    recs: [
      { card: 'Chase Sapphire Reserve', earn: '3x — gyms may code as recreation', why: 'Some gym memberships code under travel/recreation' },
      { card: 'Capital One Savor',      earn: '3% entertainment',               why: 'Fitness/recreation sometimes codes as entertainment' },
      { card: 'Citi Double Cash',       earn: '2% cash back',                   why: 'Reliable flat-rate for memberships that code as misc' },
    ],
    tip: 'Gym memberships code as Fitness, Recreation, or Miscellaneous — it varies by chain. Check your first statement to see which category fires.',
  },
  {
    match: /\brent\b|apartment|lease.*(monthly|payment)|landlord|prop.*mgmt|prop.*management|zillow.*(rent|pay)/i,
    cat: 'Rent / Housing', icon: '🏠',
    recs: [
      { card: 'Bilt Rewards',           earn: '1x on rent — no processing fee', why: 'The only major card that earns points on rent without a surcharge' },
      { card: 'Citi Double Cash',       earn: '2% (if portal accepts credit)',   why: 'If your landlord\'s platform accepts cards, 2% is your best flat-rate' },
      { card: 'Wells Fargo Active Cash', earn: '2% cash back',                  why: 'Flat-rate backup if paying via an accepting portal' },
    ],
    tip: 'Most rent platforms charge a 2-3% credit card fee. Bilt Rewards is built for renters — no processing fee on rent payments.',
  },
  {
    match: /education|tuition|college|universit|school.*(fee|payment)|student.?loan|textbook|udemy|coursera|skillshare|masterclass/i,
    cat: 'Education / Tuition', icon: '🎓',
    recs: CATCH_ALL_RECS,
    tip: 'Tuition codes as Miscellaneous. Many schools charge a 2-3% card convenience fee — weigh that against rewards before using a card.',
  },
  {
    match: /veterinar|animal.?hospital|pet.*clinic|\bvet\b(?!eran)/i,
    cat: 'Veterinary / Pet Care', icon: '🐾',
    recs: [
      { card: 'Citi Custom Cash',       earn: 'Up to 5% if top spend category', why: 'Vet bills code as misc — if it\'s your biggest monthly spend, 5%' },
      { card: 'Citi Double Cash',       earn: '2% cash back',                   why: 'Reliable flat-rate for vet bills' },
      { card: 'Wells Fargo Active Cash', earn: '2% cash back',                  why: 'Unlimited flat-rate, no category restrictions' },
    ],
    tip: 'Vet charges usually code as Miscellaneous. Petco/PetSmart retail purchases may earn more with rotating-category cards.',
  },
  {
    match: /parking|parking.?garage|parking.?lot|spothero|parkwhiz/i,
    cat: 'Parking', icon: '🅿️',
    recs: [
      { card: 'Chase Sapphire Reserve', earn: '3x on travel', why: 'Parking garages often code as transit or travel' },
      { card: 'Wells Fargo Autograph',  earn: '3x transit',   why: '3x on transit including parking garages and meters' },
      { card: 'Citi Double Cash',       earn: '2% cash back', why: 'Flat-rate backup for metered / street parking' },
    ],
    tip: 'Parking garages often code as Transit or Travel. Street meters tend to code as Miscellaneous.',
  },
  {
    match: /plumb|electric.*contract|hvac|roof|landscap|lawn.?care|handyman|home.*repair|home.*service|contractor/i,
    cat: 'Home Services / Contractors', icon: '🔧',
    recs: [
      { card: 'Citi Custom Cash',       earn: 'Up to 5% if top spend',         why: 'Home improvement/services may code as Shopping — 5% if your top category' },
      { card: 'Citi Double Cash',       earn: '2% cash back',                   why: 'Reliable catch-all for contractor invoices' },
      { card: 'Wells Fargo Active Cash', earn: '2% cash back',                  why: 'Unlimited flat-rate, no caps' },
    ],
    tip: 'Contractor payments often code as Miscellaneous or Home Improvement. Use a card with purchase protection for large jobs.',
  },
];

function findGenericCat(query) {
  for (const c of GENERIC_CATS) {
    if (c.match.test(query)) return c;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

export function renderResults(vendor, entry) {
  const res = document.getElementById('results');
  if (!entry) {
    const generic = findGenericCat(vendor);
    const catRecs  = generic ? generic.recs  : CATCH_ALL_RECS;
    const catName  = generic ? generic.cat   : 'General Purchase';
    const catIcon  = generic ? generic.icon  : '💳';
    const catTip   = generic ? generic.tip   : 'No specific vendor match. For unknown merchants, a flat-rate card gives the most reliable return.';

    const hasWallet = state.myCardIds.length > 0 || state.customCards.length > 0;
    const wallet     = hasWallet ? allWalletCards() : [];
    const walletNames = hasWallet ? new Set(wallet.map(c => c.name)) : null;

    const heroRec = hasWallet ? catRecs.find(r => walletNames.has(r.card)) : null;
    let h = heroRec ? quickHeroHTML(heroRec.card, heroRec.earn, catName, vendor) : '';
    h += `<div class="results-hdr">
      <div style="font-size:12px;color:var(--muted);margin-bottom:5px;">No exact match for "<strong style="color:var(--text);">${escHtml(vendor)}</strong>"</div>
      <div>${catIcon} Best cards for <strong>${escHtml(catName)}</strong></div>
    </div>`;
    if (hasWallet) h += `<div class="wallet-note">★ Ranked for your wallet — unowned cards shown dimmed below</div>`;

    const shown = new Set(); let rank = 0;
    if (hasWallet) {
      for (const r of catRecs) {
        if (!walletNames.has(r.card)) continue;
        rank++; shown.add(r.card); h += recHTML(rank, r, rank === 1, true, walletNames, catName, vendor);
      }
      for (const r of catRecs) { if (shown.has(r.card)) continue; h += recHTML(null, r, false, false, walletNames, catName, vendor); }
    } else {
      for (const r of catRecs) { rank++; h += recHTML(rank, r, rank === 1, true, null, catName, vendor); }
    }

    h += `<div class="tip-box">💡 ${escHtml(catTip)}</div>`;
    h += `<div style="text-align:center;padding:8px 0 2px;font-size:12px;color:var(--muted2);">Tip: search by a specific store name (e.g. "Geico" instead of "Insurance") for a closer match.</div>`;
    res.innerHTML = h;
    document.getElementById('back-search').classList.add('show');
    document.getElementById('search-wrap').style.display = 'none';
    return;
  }
  const hasWallet = state.myCardIds.length > 0 || state.customCards.length > 0;
  const wallet = hasWallet ? allWalletCards() : [];
  const walletNames = hasWallet ? new Set(wallet.map(c => c.name)) : null;
  const eCat = entry.cat, eVendor = entry.names[0];

  // Find best owned card for the quick-answer hero
  let heroRec = hasWallet ? entry.recs.find(r => walletNames.has(r.card)) : null;
  if (!heroRec && hasWallet) {
    const cc = state.customCards.find(c => c.cats.some(x => x.toLowerCase() === eCat.toLowerCase()));
    if (cc) heroRec = { card: cc.name, earn: cc.earn };
  }

  let h = heroRec ? quickHeroHTML(heroRec.card, heroRec.earn, eCat, eVendor) : '';
  h += `<div class="results-hdr">Best cards for <strong>${escHtml(entry.names[0])}</strong> <span style="font-size:11px;color:var(--muted)">(${entry.cat})</span></div>`;
  if (hasWallet) h += `<div class="wallet-note">★ Ranked for your wallet — unowned cards shown dimmed below</div>`;
  const shown = new Set(); let rank = 0;
  for (const r of entry.recs) {
    if (walletNames && !walletNames.has(r.card)) continue;
    rank++; shown.add(r.card); h += recHTML(rank, r, rank === 1, true, walletNames, eCat, eVendor);
  }
  for (const cc of state.customCards) {
    if (shown.has(cc.name)) continue;
    if (cc.cats.some(c => c.toLowerCase() === entry.cat.toLowerCase())) {
      rank++; shown.add(cc.name);
      h += recHTML(rank, { card: cc.name, earn: cc.earn, why: 'Your custom card' }, rank === 1, true, walletNames, eCat, eVendor);
    }
  }
  if (hasWallet) {
    for (const r of entry.recs) { if (shown.has(r.card)) continue; h += recHTML(null, r, false, false, walletNames, eCat, eVendor); }
  } else {
    for (const r of entry.recs) { if (shown.has(r.card)) continue; rank++; h += recHTML(rank, r, rank === 1, true, null, eCat, eVendor); }
  }
  h += `<div class="tip-box">💡 Verify category coding on your first statement — some merchants code unexpectedly. <button onclick="openDisclaimer()" style="background:none;border:none;color:var(--gold);text-decoration:underline;cursor:pointer;font-size:12px;padding:0;">Full disclaimer →</button></div>`;
  res.innerHTML = h;
  document.getElementById('back-search').classList.add('show');
  document.getElementById('search-wrap').style.display = 'none';
  // Save to recent searches using canonical vendor name
  const canonical = entry.names[0].charAt(0).toUpperCase() + entry.names[0].slice(1);
  addRecent(canonical, entry.names[0]);
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
  renderRecent();
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
      <div class="sug" onclick="selectSug('${escJs(entry.names[0])}')" role="option">
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
  haptic();
  document.getElementById('vendorInput').value = name.charAt(0).toUpperCase() + name.slice(1);
  document.getElementById('suggestions').style.display = 'none';
  lookup();
}

const QUICK_SPOTS = [
  { icon: '🛒', name: 'Grocery store', sub: 'Publix, Walmart…', vendor: 'publix' },
  { icon: '⛽', name: 'Gas station', sub: 'Shell, Exxon…', vendor: 'shell' },
  { icon: '🍔', name: 'Fast food', sub: "McDonald's, Taco Bell…", vendor: 'mcdonalds' },
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
    <button class="qt-btn" onclick="quickPick('${escJs(s.vendor)}','${escJs(s.name)}')">
      <span class="qt-icon">${s.icon}</span><div class="qt-name">${escHtml(s.name)}</div>
      <div class="qt-sub">${escHtml(s.sub)}</div><div class="qt-earn">${escHtml(bestEarn(s.vendor))}</div>
    </button>`).join('');
  document.getElementById('qt-grid2').innerHTML = QUICK_BILLS.map(s => `
    <button class="qt-btn" onclick="quickPick('${escJs(s.vendor)}','${escJs(s.name)}')">
      <span class="qt-icon">${s.icon}</span><div class="qt-name">${escHtml(s.name)}</div>
      <div class="qt-sub">${escHtml(s.sub)}</div><div class="qt-earn">${escHtml(bestEarn(s.vendor))}</div>
    </button>`).join('');
  renderRecent();
}

export function quickPick(v, d) {
  haptic();
  switchTab('search');
  document.getElementById('vendorInput').value = d;
  renderResults(d, findBestVendor(v));
}
