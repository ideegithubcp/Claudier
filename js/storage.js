export function loadS(k, d) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; }
}
export function saveS(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('[SwipeRight] localStorage full:', e); }
}
