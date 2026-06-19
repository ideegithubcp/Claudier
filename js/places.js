import { GOOGLE_PLACES_API_KEY } from './config.js';
import { showToast, escAttr, escHtml } from './ui.js';
import { findBestVendor } from './search.js';
import { state } from './state.js';

const NEARBY_FALLBACK = [
  { name: 'Publix', cat: 'Grocery', dist: '0.4 mi', best: 'Amex Gold — 4x MR', vendor: 'publix' },
  { name: 'Shell Gas', cat: 'Gas Station', dist: '0.6 mi', best: 'Citi Costco Visa — 4%', vendor: 'shell' },
  { name: 'CVS Pharmacy', cat: 'Drugstore', dist: '0.8 mi', best: 'Chase Freedom Unlimited — 3%', vendor: 'cvs' },
  { name: 'Starbucks', cat: 'Coffee', dist: '0.9 mi', best: 'Amex Gold — 4x MR', vendor: 'starbucks' },
  { name: "McDonald's", cat: 'Fast Food', dist: '1.1 mi', best: 'Amex Gold — 4x MR', vendor: "mcdonald's" },
  { name: 'Walgreens', cat: 'Drugstore', dist: '1.3 mi', best: 'Apple Card — 3%', vendor: 'walgreens' },
  { name: 'Target', cat: 'Retail', dist: '1.8 mi', best: 'RedCard 5% / Citi Custom 5%', vendor: 'target' },
  { name: 'Home Depot', cat: 'Home Improvement', dist: '2.1 mi', best: 'Citi Custom Cash — 5%', vendor: 'home depot' },
];

const PLACE_TYPE_MAP = {
  'supermarket': 'grocery store', 'grocery_or_supermarket': 'grocery store',
  'gas_station': 'shell', 'convenience_store': 'circle k',
  'pharmacy': 'cvs', 'drugstore': 'cvs',
  'restaurant': 'restaurant', 'food': 'restaurant',
  'cafe': 'starbucks', 'bakery': 'starbucks',
  'department_store': 'target', 'clothing_store': 'target',
  'home_goods_store': 'home depot', 'hardware_store': 'home depot',
  'electronics_store': 'best buy', 'movie_theater': 'amc',
  'gym': 'planet fitness', 'lodging': 'marriott',
};

function loadMapsApi() {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) { resolve(); return; }
    if (window.__mapsApiResolvers) { window.__mapsApiResolvers.push({ resolve, reject }); return; }
    window.__mapsApiResolvers = [{ resolve, reject }];
    window.__mapsApiReady = function () {
      (window.__mapsApiResolvers || []).forEach(r => r.resolve());
      window.__mapsApiResolvers = null;
    };
    window.gm_authFailure = function () {
      const err = new Error('Maps API key invalid or not authorized for Maps JavaScript API');
      console.error('[SwipeRight]', err.message, '— check Google Cloud Console: enable Maps JavaScript API and verify HTTP referrer restrictions include your Netlify domain.');
      (window.__mapsApiResolvers || []).forEach(r => r.reject(err));
      window.__mapsApiResolvers = null;
    };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_PLACES_API_KEY}&libraries=places&callback=__mapsApiReady`;
    s.onerror = () => {
      const err = new Error('Failed to load Google Maps script — check network or API key');
      console.error('[SwipeRight]', err.message);
      (window.__mapsApiResolvers || []).forEach(r => r.reject(err));
      window.__mapsApiResolvers = null;
    };
    document.head.appendChild(s);
  });
}

function getHiddenMapDiv() {
  let d = document.getElementById('__map_hidden');
  if (!d) {
    d = document.createElement('div');
    d.id = '__map_hidden';
    d.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(d);
  }
  return d;
}

function calcDist(lat1, lng1, lat2, lng2) {
  const R = 3958.8, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
}

export function renderNearbyFallback() {
  document.getElementById('nearby-grid').innerHTML = NEARBY_FALLBACK.map(s => `
    <div class="nearby-card" onclick="nearbyPick('${escAttr(s.vendor)}','${escAttr(s.name)}')">
      <div class="nearby-name">${s.name}</div>
      <div class="nearby-cat">${s.cat}</div>
      <div class="nearby-dist">📍 ${s.dist}</div>
      <div class="nearby-best">${s.best}</div>
    </div>`).join('');
  document.getElementById('gps-sub').textContent = 'Showing example stores — add a Google Places API key for live results';
}

function renderNearbyFromPlaces(places) {
  if (!places.length) { renderNearbyFallback(); return; }
  document.getElementById('nearby-grid').innerHTML = places.map(p => {
    const vendorKey = p.types.map(t => PLACE_TYPE_MAP[t]).find(Boolean) || p.name.toLowerCase().split(' ')[0];
    const bestEntry = findBestVendor(vendorKey) || findBestVendor(p.name);
    const bestRec = bestEntry?.recs[0];
    const owned = bestRec ? [...state.CARD_CATALOG.filter(c => state.myCardIds.includes(c.id)), ...state.customCards].find(c => c.name === bestRec.card) : null;
    const bestCard = owned ? bestRec.card : (bestRec?.card || 'Check your wallet');
    const bestEarn = bestRec?.earn || '';
    return `<div class="nearby-card" onclick="nearbyPick('${escAttr(vendorKey)}','${escAttr(p.name)}')">
      <div class="nearby-name">${escHtml(p.name)}</div>
      <div class="nearby-cat">${p.types[0]?.replace(/_/g, ' ') || 'Store'}</div>
      ${p.dist ? `<div class="nearby-dist">📍 ${p.dist} mi</div>` : ''}
      <div class="nearby-best">${escHtml(bestCard)}${bestEarn ? ' — ' + bestEarn : ''}</div>
    </div>`;
  }).join('');
}

export async function fetchNearbyPlaces(lat, lng) {
  document.getElementById('nearby-grid').innerHTML = '<div style="grid-column:1/-1;padding:1rem;text-align:center;color:var(--muted);font-size:13px;">Finding stores near you…</div>';
  try {
    await loadMapsApi();
    const map = new google.maps.Map(getHiddenMapDiv(), { center: { lat, lng }, zoom: 15 });
    const svc = new google.maps.places.PlacesService(map);
    const types = ['supermarket', 'gas_station', 'pharmacy', 'restaurant', 'department_store'];
    const results = [];
    await Promise.all(types.map(type => new Promise(res => {
      svc.nearbySearch({ location: { lat, lng }, radius: 2000, type }, (places, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && places) {
          results.push(...places.slice(0, 2).map(p => ({
            name: p.name,
            types: p.types || [],
            dist: p.geometry?.location ? calcDist(lat, lng, p.geometry.location.lat(), p.geometry.location.lng()) : null,
            rating: p.rating,
          })));
        }
        res();
      });
    })));
    if (results.length) renderNearbyFromPlaces(results.slice(0, 8));
    else { renderNearbyFallback(); showToast('No stores found nearby', 'error'); }
  } catch (e) {
    renderNearbyFallback();
    showToast('Places API error — check console for details', 'error');
  }
}

export function startGPS() {
  const btn = document.getElementById('gps-btn'), lbl = document.getElementById('gps-lbl'), sub = document.getElementById('gps-sub');
  btn.classList.add('pulsing'); lbl.textContent = 'Detecting location…'; sub.textContent = '';
  if (!navigator.geolocation) {
    btn.classList.remove('pulsing'); lbl.textContent = 'GPS unavailable';
    document.getElementById('places-manual-row').style.display = 'flex';
    renderNearbyFallback(); return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      btn.classList.remove('pulsing');
      const { latitude: lat, longitude: lng } = pos.coords;
      lbl.textContent = 'Location found';
      sub.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      if (GOOGLE_PLACES_API_KEY) {
        fetchNearbyPlaces(lat, lng);
      } else {
        sub.textContent += ' — Add a Places API key for live results';
        document.getElementById('places-manual-row').style.display = 'flex';
        renderNearbyFallback();
      }
    },
    () => {
      btn.classList.remove('pulsing');
      lbl.textContent = 'Could not detect location';
      document.getElementById('places-manual-row').style.display = 'flex';
      renderNearbyFallback();
    },
    { timeout: 10000, enableHighAccuracy: true }
  );
}

export function searchPlacesByText() {
  const loc = document.getElementById('places-loc-input').value.trim();
  if (!loc) { showToast('Enter a location to search', 'error'); return; }
  if (!GOOGLE_PLACES_API_KEY) { renderNearbyFallback(); showToast('Add a Google Places API key in the app config', 'error'); return; }
  document.getElementById('nearby-grid').innerHTML = '<div style="grid-column:1/-1;padding:1rem;text-align:center;color:var(--muted);font-size:13px;">Searching…</div>';
  loadMapsApi().then(() => {
    new google.maps.Geocoder().geocode({ address: loc }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const loc2 = results[0].geometry.location;
        fetchNearbyPlaces(loc2.lat(), loc2.lng());
      } else {
        renderNearbyFallback(); showToast('Location not found', 'error');
      }
    });
  }).catch(() => { renderNearbyFallback(); });
}

export function nearbyPick(v, n) {
  import('./ui.js').then(({ switchTab }) => switchTab('search'));
  document.getElementById('vendorInput').value = n;
  import('./search.js').then(({ renderResults, findBestVendor }) => renderResults(n, findBestVendor(v)));
}
