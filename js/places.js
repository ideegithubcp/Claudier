import { GOOGLE_PLACES_API_KEY } from './config.js';
import { showToast, escAttr, escHtml, switchTab } from './ui.js';
import { findBestVendor, renderResults } from './search.js';
import { state } from './state.js';
import { allWalletCards } from './cards.js';

const NEARBY_FALLBACK = [
  { name: 'Publix', cat: 'Grocery', dist: '0.4', best: 'Amex Gold — 4x MR', vendor: 'publix' },
  { name: 'Shell Gas', cat: 'Gas Station', dist: '0.6', best: 'Citi Costco Visa — 4%', vendor: 'shell' },
  { name: 'CVS Pharmacy', cat: 'Drugstore', dist: '0.8', best: 'Chase Freedom Unlimited — 3%', vendor: 'cvs' },
  { name: 'Starbucks', cat: 'Coffee', dist: '0.9', best: 'Amex Gold — 4x MR', vendor: 'starbucks' },
  { name: "McDonald's", cat: 'Fast Food', dist: '1.1', best: 'Amex Gold — 4x MR', vendor: "mcdonald's" },
  { name: 'Walgreens', cat: 'Pharmacy', dist: '1.3', best: 'Apple Card — 3%', vendor: 'walgreens' },
  { name: 'Target', cat: 'Retail', dist: '1.8', best: 'RedCard 5% / Citi Custom 5%', vendor: 'target' },
  { name: 'Home Depot', cat: 'Home Improvement', dist: '2.1', best: 'Citi Custom Cash — 5%', vendor: 'home depot' },
];

const CAT_ICONS = {
  'Grocery': '🛒', 'Gas Station': '⛽', 'Drugstore': '💊', 'Pharmacy': '💊',
  'Coffee': '☕', 'Fast Food': '🍔', 'Retail': '🛍️', 'Restaurant': '🍽️',
  'Home Improvement': '🔨', 'Electronics': '📱', 'Convenience': '🏪',
  'Department Store': '🏬', 'supermarket': '🛒', 'gas_station': '⛽',
  'pharmacy': '💊', 'restaurant': '🍽️', 'cafe': '☕', 'department_store': '🏬',
};

// Maps Google Places types to vendor DB keys
const PLACE_TYPE_MAP = {
  'supermarket': 'grocery store', 'grocery_or_supermarket': 'grocery store',
  'gas_station': 'shell', 'convenience_store': 'circle k',
  'pharmacy': 'cvs', 'drugstore': 'cvs',
  // Restaurant-type places → use mcdonald's as generic dining proxy (has broad Dining recs)
  'restaurant': "mcdonald's", 'food': "mcdonald's",
  'cafe': 'starbucks', 'bakery': 'starbucks',
  'department_store': 'target', 'clothing_store': 'target',
  'home_goods_store': 'home depot', 'hardware_store': 'home depot',
  'electronics_store': 'best buy', 'movie_theater': 'amc',
  'gym': 'planet fitness', 'lodging': 'marriott',
};

function loadMapsApi() {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) { resolve(); return; }

    // Register auth failure handler BEFORE injecting script to avoid race
    window.gm_authFailure = function () {
      const err = new Error('Maps API key not authorized — enable Maps JavaScript API + billing in Google Cloud Console, and whitelist your Netlify domain under HTTP referrers.');
      console.error('[SwipeRight]', err.message);
      if (window.__mapsApiResolvers) {
        window.__mapsApiResolvers.forEach(r => r.reject(err));
        window.__mapsApiResolvers = null;
      }
    };

    if (window.__mapsApiResolvers) {
      window.__mapsApiResolvers.push({ resolve, reject });
      return;
    }
    window.__mapsApiResolvers = [{ resolve, reject }];
    window.__mapsApiReady = function () {
      if (window.__mapsApiResolvers) {
        window.__mapsApiResolvers.forEach(r => r.resolve());
        window.__mapsApiResolvers = null;
      }
    };

    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_PLACES_API_KEY}&libraries=places&callback=__mapsApiReady`;
    s.async = true;
    s.onerror = () => {
      const err = new Error('Google Maps script failed to load — check network and API key');
      console.error('[SwipeRight]', err.message);
      if (window.__mapsApiResolvers) {
        window.__mapsApiResolvers.forEach(r => r.reject(err));
        window.__mapsApiResolvers = null;
      }
    };
    document.head.appendChild(s);
  });
}

function getHiddenMapDiv() {
  let d = document.getElementById('__map_hidden');
  if (!d) {
    d = document.createElement('div');
    d.id = '__map_hidden';
    d.style.cssText = 'position:fixed;bottom:-9999px;width:1px;height:1px;';
    document.body.appendChild(d);
  }
  return d;
}

function calcDist(lat1, lng1, lat2, lng2) {
  const R = 3958.8, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
}

function setSectionLabel(text) {
  const lbl = document.getElementById('nearby-section-lbl');
  if (lbl) lbl.textContent = text;
}

function showNearbyLoading() {
  setSectionLabel('Finding stores…');
  document.getElementById('nearby-grid').innerHTML = Array(6).fill(
    `<div class="nearby-card" style="pointer-events:none">
      <div class="nearby-icon skeleton" style="width:32px;height:32px;border-radius:8px;margin-bottom:8px;"></div>
      <div class="skeleton" style="height:13px;width:75%;margin-bottom:7px;border-radius:6px;"></div>
      <div class="skeleton" style="height:11px;width:45%;margin-bottom:6px;border-radius:6px;"></div>
      <div class="skeleton" style="height:11px;width:90%;border-radius:6px;"></div>
    </div>`
  ).join('');
}

function nearbyCardHTML(name, cat, dist, best, vendor) {
  const icon = CAT_ICONS[cat] || '🏪';
  return `<div class="nearby-card" onclick="nearbyPick('${escAttr(vendor)}','${escAttr(name)}')">
    <div class="nearby-icon">${icon}</div>
    <div class="nearby-name">${escHtml(name)}</div>
    <div class="nearby-cat">${escHtml(cat)}</div>
    ${dist ? `<div class="nearby-dist">📍 ${dist} mi</div>` : ''}
    <div class="nearby-best">${escHtml(best)}</div>
  </div>`;
}

export function renderNearbyFallback(isExample = true) {
  setSectionLabel(isExample ? 'Example stores' : 'Nearby stores');
  document.getElementById('nearby-grid').innerHTML = NEARBY_FALLBACK.map(s =>
    nearbyCardHTML(s.name, s.cat, isExample ? s.dist : null, s.best, s.vendor)
  ).join('');
  if (isExample) {
    document.getElementById('gps-sub').textContent = 'Examples below — tap GPS button for live stores near you';
  } else {
    document.getElementById('gps-sub').textContent = 'No live results found — showing example stores';
  }
}

function renderNearbyFromPlaces(places) {
  if (!places.length) { renderNearbyFallback(false); return; }
  setSectionLabel('Nearby stores');
  const walletCards = allWalletCards();
  const walletNames = new Set(walletCards.map(c => c.name));

  document.getElementById('nearby-grid').innerHTML = places.map(p => {
    const rawType = p.types[0] || '';
    const catLabel = rawType.replace(/_/g, ' ');
    const icon = CAT_ICONS[rawType] || CAT_ICONS[catLabel] || '🏪';
    const vendorKey = p.types.map(t => PLACE_TYPE_MAP[t]).find(Boolean) || p.name.toLowerCase().split(' ')[0];
    const bestEntry = findBestVendor(vendorKey) || findBestVendor(p.name);
    const recs = bestEntry?.recs || [];
    // Prefer a card the user owns; fall back to catalog's top pick
    const ownedRec = recs.find(r => walletNames.has(r.card));
    const bestRec = ownedRec || recs[0];
    const bestCard = bestRec?.card || 'Check your wallet';
    const bestEarn = bestRec?.earn || '';
    return `<div class="nearby-card" onclick="nearbyPick('${escAttr(vendorKey)}','${escAttr(p.name)}')">
      <div class="nearby-icon">${icon}</div>
      <div class="nearby-name">${escHtml(p.name)}</div>
      <div class="nearby-cat">${escHtml(catLabel || 'Store')}</div>
      ${p.dist ? `<div class="nearby-dist">📍 ${p.dist} mi</div>` : ''}
      <div class="nearby-best">${escHtml(bestCard)}${bestEarn ? ' — ' + bestEarn : ''}</div>
    </div>`;
  }).join('');
}

const FETCH_TIMEOUT = 10000;

export async function fetchNearbyPlaces(lat, lng) {
  showNearbyLoading();
  try {
    await Promise.race([
      loadMapsApi(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), FETCH_TIMEOUT)),
    ]);

    const map = new google.maps.Map(getHiddenMapDiv(), { center: { lat, lng }, zoom: 14 });
    const svc = new google.maps.places.PlacesService(map);
    const types = ['supermarket', 'gas_station', 'pharmacy', 'restaurant', 'department_store'];
    const results = [];

    await Promise.race([
      Promise.all(types.map(type => new Promise(res => {
        svc.nearbySearch({ location: { lat, lng }, radius: 4800, type }, (places, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && places) {
            results.push(...places.slice(0, 3).map(p => ({
              name: p.name,
              types: p.types || [],
              dist: p.geometry?.location ? calcDist(lat, lng, p.geometry.location.lat(), p.geometry.location.lng()) : null,
              rating: p.rating,
            })));
          }
          res();
        });
      }))),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), FETCH_TIMEOUT)),
    ]);

    if (results.length) {
      results.sort((a, b) => (parseFloat(a.dist) || 99) - (parseFloat(b.dist) || 99));
      renderNearbyFromPlaces(results.slice(0, 8));
      document.getElementById('gps-sub').textContent = `${results.length} stores found within 3 miles`;
    } else {
      renderNearbyFallback(false);
      showToast('No stores found within 3 miles', 'error');
    }
  } catch (e) {
    console.error('[SwipeRight] fetchNearbyPlaces:', e.message);
    renderNearbyFallback(true);
    const isTimeout = e.message === 'timeout';
    showToast(
      isTimeout
        ? 'Timed out — check Maps API key in Google Cloud Console'
        : 'Places API error — check browser console',
      'error'
    );
  }
}

export function initNearbyTab() {
  const grid = document.getElementById('nearby-grid');
  if (!grid) return;
  if (!grid.children.length || grid.querySelector('[style*="pointer-events:none"]')) {
    renderNearbyFallback(true);
  }
}

export function startGPS() {
  const btn = document.getElementById('gps-btn');
  const lbl = document.getElementById('gps-lbl');
  const sub = document.getElementById('gps-sub');
  btn.classList.add('pulsing'); lbl.textContent = 'Detecting location…'; sub.textContent = '';

  if (!navigator.geolocation) {
    btn.classList.remove('pulsing'); lbl.textContent = 'GPS unavailable';
    renderNearbyFallback(true); return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      btn.classList.remove('pulsing');
      const { latitude: lat, longitude: lng } = pos.coords;
      lbl.textContent = 'Searching nearby…';
      sub.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)} · within 3 miles`;
      if (GOOGLE_PLACES_API_KEY) {
        fetchNearbyPlaces(lat, lng);
      } else {
        sub.textContent += ' — Add a Places API key for live results';
        renderNearbyFallback(true);
      }
    },
    err => {
      btn.classList.remove('pulsing');
      lbl.textContent = err.code === 1 ? 'Location permission denied' : 'Could not detect location';
      sub.textContent = 'Enter a location below to search manually';
      renderNearbyFallback(true);
    },
    { timeout: 10000, enableHighAccuracy: false }
  );
}

export function searchPlacesByText() {
  const loc = document.getElementById('places-loc-input').value.trim();
  if (!loc) { showToast('Enter a location to search', 'error'); return; }
  if (!GOOGLE_PLACES_API_KEY) { renderNearbyFallback(true); showToast('No Places API key configured', 'error'); return; }
  showNearbyLoading();
  Promise.race([
    loadMapsApi(),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), FETCH_TIMEOUT)),
  ]).then(() => {
    new google.maps.Geocoder().geocode({ address: loc }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const loc2 = results[0].geometry.location;
        fetchNearbyPlaces(loc2.lat(), loc2.lng());
      } else {
        renderNearbyFallback(true); showToast('Location not found', 'error');
      }
    });
  }).catch(e => {
    renderNearbyFallback(true);
    showToast(e.message === 'timeout' ? 'Maps API timed out' : 'Could not load Maps', 'error');
  });
}

export function nearbyPick(v, n) {
  switchTab('search');
  document.getElementById('vendorInput').value = n;
  renderResults(n, findBestVendor(v));
}
