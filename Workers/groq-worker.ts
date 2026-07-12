// ===== groq-worker.js =====
// Cloudflare Worker بسيط يحتفظ بمفتاح Groq بالسيرفر ويمرر طلبات التطبيق له.
// التطبيق ما يعرف المفتاح نهائياً - بس يعرف رابط هذا الـ Worker.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-app-secret',
};

export default {
  async fetch(request: { method: string; headers: { get: (arg0: string) => any; }; text: () => any; }, env: { APP_SHARED_SECRET: any; GROQ_API_KEY: string; }) {
    // المتصفح يرسل OPTIONS (preflight) قبل POST - لازم نرد عليه
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    const appSecret = request.headers.get('x-app-secret');
    if (env.APP_SHARED_SECRET && appSecret !== env.APP_SHARED_SECRET) {
      return new Response('Forbidden', { status: 403, headers: CORS_HEADERS });
    }

    let body;
    try {
      body = await request.text();
    } catch {
      return new Response('Bad request', { status: 400, headers: CORS_HEADERS });
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + env.GROQ_API_KEY,
      },
      body,
    });

    const text = await groqRes.text();
    return new Response(text, {
      status: groqRes.status,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  },
};