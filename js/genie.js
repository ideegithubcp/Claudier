import { state } from './state.js';
import { GENIE_WORKER_URL } from './config.js';

const DAILY_KEY = 'sr_genie_daily';
const LIMIT = 3;

// ── Daily limit ──────────────────────────────────────────────────────────────
function getUsage() {
  try {
    const d = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}');
    if (d.date !== new Date().toDateString()) return { date: new Date().toDateString(), count: 0 };
    return d;
  } catch { return { date: new Date().toDateString(), count: 0 }; }
}
function recordUse() {
  const u = getUsage(); u.count++;
  localStorage.setItem(DAILY_KEY, JSON.stringify(u));
}
function refundUse() {
  const u = getUsage(); u.count = Math.max(0, u.count - 1);
  localStorage.setItem(DAILY_KEY, JSON.stringify(u));
}
function remaining() { return Math.max(0, LIMIT - getUsage().count); }

// ── Chat state (session only, clears on reload) ──────────────────────────────
let messages = [];

// ── Context builder ──────────────────────────────────────────────────────────
function buildContext() {
  const catalog = state.CARD_CATALOG || [];
  const walletCards = (state.myCardIds || []).map(id => {
    const c = catalog.find(x => x.id === id);
    return c ? `${c.name} (AF $${c.af}/yr — ${c.tip ? c.tip.slice(0, 100) : ''})` : id;
  });
  const customCards = (state.customCards || []).map(c =>
    `${c.name} [custom card] (AF $${c.af || 0}/yr)`
  );
  const all = [...walletCards, ...customCards];
  return all.length
    ? `User's current wallet:\n${all.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
    : 'User has no cards in their wallet yet.';
}

// ── Rendering ────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function renderMessages() {
  const box = document.getElementById('genie-messages');
  if (!box) return;
  if (messages.length === 0) {
    box.innerHTML = `
      <div class="genie-welcome">
        <div class="genie-welcome-icon">🪔</div>
        <div class="genie-welcome-text">
          <strong>Ask me anything about your cards</strong>
          <p>Try: "Which card is best for groceries?" or "Is my Amex Gold annual fee worth it?" or "Which cards should I cancel?"</p>
        </div>
      </div>
      <div class="genie-chips">
        <button class="genie-chip" onclick="genieChip('How do I maximize my grocery rewards?')">🛒 Grocery rewards</button>
        <button class="genie-chip" onclick="genieChip('Which cards should I cancel to simplify my wallet?')">✂️ Simplify wallet</button>
        <button class="genie-chip" onclick="genieChip('How much do I need to spend to recover my annual fees this year?')">💰 Fee recovery</button>
        <button class="genie-chip" onclick="genieChip('How can I get more travel benefits from my current cards?')">✈️ Travel perks</button>
      </div>`;
    return;
  }
  box.innerHTML = messages.map(m => `
    <div class="genie-msg genie-msg-${m.role}">
      ${m.role === 'assistant' ? '<span class="genie-ai-icon">🪔</span>' : ''}
      <div class="genie-bubble">${esc(m.content)}</div>
    </div>`).join('');
  box.scrollTop = box.scrollHeight;
}

function updateCounter() {
  const el = document.getElementById('genie-counter');
  if (!el) return;
  const r = remaining();
  el.textContent = `${r} / ${LIMIT} questions left today`;
  el.classList.toggle('genie-counter-warn', r === 0);
}

function setLoading(on) {
  const btn = document.getElementById('genie-send');
  const inp = document.getElementById('genie-input');
  if (btn) { btn.disabled = on; btn.textContent = on ? '…' : 'Ask'; }
  if (inp) inp.disabled = on;

  const box = document.getElementById('genie-messages');
  if (!box) return;
  if (on) {
    const el = document.createElement('div');
    el.className = 'genie-msg genie-msg-assistant genie-typing';
    el.id = 'genie-typing';
    el.innerHTML = '<span class="genie-ai-icon">🪔</span><div class="genie-bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  } else {
    document.getElementById('genie-typing')?.remove();
  }
}

// ── Core ask function ────────────────────────────────────────────────────────
async function ask(question) {
  if (!question) return;
  if (remaining() <= 0) {
    showGenieToast('You\'ve used all 3 questions for today. Come back tomorrow! 🪔');
    return;
  }

  messages.push({ role: 'user', content: question });
  renderMessages();
  setLoading(true);
  recordUse();
  updateCounter();

  try {
    if (!GENIE_WORKER_URL || GENIE_WORKER_URL === 'YOUR_WORKER_URL') {
      throw new Error('NOT_CONFIGURED');
    }

    const res = await fetch(GENIE_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context: buildContext() }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    messages.push({ role: 'assistant', content: data.answer || 'No response received.' });

  } catch (e) {
    if (e.message === 'NOT_CONFIGURED') {
      refundUse(); // don't charge the question
      messages.push({ role: 'assistant', content: 'The AI backend isn\'t set up yet. Deploy worker.js to Cloudflare Workers and update GENIE_WORKER_URL in js/config.js.' });
    } else {
      messages.push({ role: 'assistant', content: 'Something went wrong reaching the AI. Please try again in a moment.' });
    }
  }

  setLoading(false);
  renderMessages();
  updateCounter();
}

function showGenieToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.className = 'toast show';
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ── Public API ───────────────────────────────────────────────────────────────
export function genieAsk() {
  const inp = document.getElementById('genie-input');
  const q = inp?.value.trim();
  if (!q) return;
  inp.value = '';
  inp.style.height = 'auto';
  ask(q);
}

export function genieChip(text) {
  ask(text);
}

export function openGenie() {
  document.getElementById('genie-overlay')?.classList.add('show');
  updateCounter();
  renderMessages();
  setTimeout(() => document.getElementById('genie-input')?.focus(), 280);
}

export function closeGenie() {
  document.getElementById('genie-overlay')?.classList.remove('show');
}

export function initGenie() {
  const inp = document.getElementById('genie-input');
  if (!inp) return;

  // Auto-grow textarea
  inp.addEventListener('input', () => {
    inp.style.height = 'auto';
    inp.style.height = Math.min(inp.scrollHeight, 100) + 'px';
  });

  // Enter to send (Shift+Enter for newline)
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); genieAsk(); }
  });
}
