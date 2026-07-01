/**
 * SwipeRight — Card Genie Worker
 *
 * Paste this entire file into the Cloudflare Workers dashboard editor.
 * After saving, go to Settings → Variables → add ANTHROPIC_API_KEY as an encrypted secret.
 *
 * If you prefer CLI: wrangler deploy worker.js --name swiperight-genie
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let question, context;
  try {
    const body = await request.json();
    question = body.question;
    context  = body.context || '';
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (!question) return new Response('Missing question', { status: 400 });

  // ANTHROPIC_API_KEY is injected as a global by Cloudflare from your secret
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: `You are a concise, friendly credit card advisor inside SwipeRight, a personal card optimizer PWA.
${context}
Rules:
- Answer in plain text only — no markdown, no bullet symbols, no headers.
- Keep answers to 3-5 sentences. Be specific and actionable.
- For best card at a merchant: rank the user's wallet cards by earn rate for that category.
- For cancelling cards: weigh annual fee vs benefits used, credit utilization, and card age.
- For annual fee recovery: calculate exact spend needed based on earn rate and fee.
- For travel benefits: summarize what the user already has, then suggest the single best upgrade.
- If the user has no wallet cards, encourage them to add cards via the MyWallet tab.`,
      messages: [{ role: 'user', content: question }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(JSON.stringify({ error: err }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  const data = await res.json();
  const answer = data.content[0].text || 'No response from AI.';

  return new Response(JSON.stringify({ answer }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
