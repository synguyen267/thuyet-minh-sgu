import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createPoiApp, createAiApp, createAnalyticsApp } from '../index.js';

const env = { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon', GEMINI_API_KEY: 'gk' };
const listen = (server) => new Promise((res) => server.listen(0, () => res(`http://127.0.0.1:${server.address().port}`)));

async function withApp(app, fn) {
  const server = http.createServer(app);
  const base = await listen(server);
  try { await fn(base); } finally { await new Promise((r) => server.close(r)); }
}
const status = async (base, path, init) => (await fetch(base + path, init)).status;
const bearer = { headers: { Authorization: 'Bearer khong-phai-admin' } };

test('mỗi dịch vụ tự báo sức khỏe bằng tên của chính nó, không cần đăng nhập', async () => {
  const cases = [
    [createPoiApp(env), '/api/pois/health', 'poi-service'],
    [createAiApp(env), '/api/ai/health', 'ai-service'],
    [createAnalyticsApp(env), '/api/stats/health', 'analytics-service'],
  ];
  for (const [app, path, name] of cases) {
    await withApp(app, async (b) => {
      const r = await fetch(b + path);
      assert.equal(r.status, 200);
      assert.equal((await r.json()).service, name);
    });
  }
});

test('dịch vụ chỉ có đường dẫn của chính nó: gọi nhầm sang dịch vụ khác thì 404', async () => {
  await withApp(createPoiApp(env), async (b) => {
    assert.equal(await status(b, '/api/ai/draft', { method: 'POST' }), 404);
    assert.equal(await status(b, '/api/stats', bearer), 404);
  });
  await withApp(createAiApp(env), async (b) => {
    assert.equal(await status(b, '/api/pois', { method: 'POST' }), 404);
    assert.equal(await status(b, '/api/stats', bearer), 404);
  });
  await withApp(createAnalyticsApp(env), async (b) => {
    assert.equal(await status(b, '/api/pois', { method: 'POST' }), 404);
    assert.equal(await status(b, '/api/ai/draft', { method: 'POST' }), 404);
  });
});

test('mỗi dịch vụ tự kiểm tra quyền admin: không có token thì 401', async () => {
  await withApp(createPoiApp(env), async (b) => assert.equal(await status(b, '/api/pois/a/plays'), 401));
  await withApp(createAiApp(env), async (b) => assert.equal(await status(b, '/api/ai/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), 401));
  await withApp(createAnalyticsApp(env), async (b) => assert.equal(await status(b, '/api/stats'), 401));
});

test('lỗi ở dịch vụ AI không ảnh hưởng dịch vụ POI (hai ứng dụng độc lập)', async () => {
  const origErr = console.error; console.error = () => {};
  try {
    const noKey = createAiApp({ VITE_SUPABASE_URL: env.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY });
    await withApp(noKey, async (b) => assert.equal(await status(b, '/api/ai/health'), 200)); // AI sống dù thiếu khóa Gemini
    await withApp(createPoiApp(env), async (b) => assert.equal(await status(b, '/api/pois/health'), 200));
  } finally { console.error = origErr; }
});
