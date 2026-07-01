/**
 * SwipeRight — Card Genie Worker
 * Deploy to Cloudflare Workers (free tier: 100K req/day)
 *
 * Steps:
 *   1. npm install -g wrangler
 *   2. wrangler login
 *   3. wrangler secret put ANTHROPIC_API_KEY   (paste your key)
 *   4. wrangler deploy worker.js --name swiperight-genie
 *   5. Copy the *.workers.dev URL into GENIE_WORKER_URL in js/config.js
 */

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    let question, context;
    try {
      ({ question, context } = await request.json());
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }
    if (!question) return new Response('Missing question', { status: 400 });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
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
- Keep answers to 3-5 sentences maximum. Be specific and actionable.
- For "best card at X merchant": rank the user's wallet cards by earn rate at that merchant category.
- For "should I cancel": weigh annual fee vs benefits used, credit utilization, and card age impact.
- For "annual fee recovery": calculate exact spend needed based on earn rate and fee.
- For "travel benefits": summarize what the user already has, then suggest the single best upgrade.
- If the user has no wallet cards, encourage them to add cards first via the MyWallet tab.`,
        messages: [{ role: 'user', content: question }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: err }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }

    const data = await res.json();
    const answer = data.content?.[0]?.text || 'No response from AI.';
    return new Response(JSON.stringify({ answer }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  },
};
