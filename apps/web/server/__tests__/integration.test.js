import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRealApp } from '../index.js';
import { createApp } from '../app.js';

const env = { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon-key', GEMINI_API_KEY: 'gk' };

/** Máy chủ giả lập cách Vercel làm: đọc hết nội dung trước, gắn vào req.body rồi mới gọi ứng dụng (stream đã cạn). */
function vercelLike(app) {
  return http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      if (raw) req.body = JSON.parse(raw);
      app(req, res);
    });
  });
}
const listen = (server) => new Promise((res) => server.listen(0, () => res(`http://127.0.0.1:${server.address().port}`)));

test('kiểu Vercel: nội dung đã đọc sẵn vào req.body thì vẫn chạy, không treo', async () => {
  const app = createApp({
    isAdmin: async () => true,
    controllers: {
      poi: {}, stats: {},
      ai: { draft: async (req, res) => res.json({ got: req.body }), translate: async () => {} },
    },
  });
  const server = vercelLike(app);
  const base = await listen(server);
  try {
    const r = await fetch(`${base}/api/ai/draft`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' }, body: JSON.stringify({ name: 'A' }) });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { got: { name: 'A' } });
  } finally { server.close(); }
});

test('chuỗi thật: HTTP → controller → service → repository → Supabase (giả), kèm token và apikey đúng', async () => {
  const seen = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (!u.startsWith('https://x.supabase.co')) return realFetch(url, opts); // gọi tới máy chủ thử cục bộ thì cho qua
    const h = new Headers(opts.headers);
    seen.push({ method: opts.method || 'GET', url: u.replace('https://x.supabase.co', ''), auth: h.get('authorization'), apikey: h.get('apikey'), body: opts.body });
    const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/0' } });
    if (u.includes('/rpc/is_admin')) return json(200, h.get('authorization') === 'Bearer admin-token');
    if (u.includes('/rest/v1/play_log')) return json(200, []);
    if (u.includes('/rest/v1/poi_translation')) return new Response(null, { status: 201 });
    if (u.includes('/rest/v1/poi')) return new Response(null, { status: 201 });
    return json(404, {});
  };
  const app = createRealApp(env);
  const server = http.createServer(app);
  const base = await listen(server);
  try {
    const ok = await realFetch(`${base}/api/pois`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' }, body: JSON.stringify({ id: 'khu-z', name_vi: 'Khu Z', tour_order: 12 }) });
    assert.equal(ok.status, 201);
    assert.deepEqual((await ok.json()).result, { id: 'khu-z' });
    const posts = seen.filter((s) => s.method === 'POST' && s.url.startsWith('/rest/v1/poi'));
    assert.equal(posts.length, 2);
    assert.equal(posts[0].auth, 'Bearer admin-token');
    assert.equal(posts[0].apikey, 'anon-key');
    assert.deepEqual(JSON.parse(posts[0].body), { id: 'khu-z', tour_order: 12, radius_m: 20, priority: 1, is_active: false });

    const notAdmin = await realFetch(`${base}/api/pois`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer khach' }, body: JSON.stringify({ id: 'x', name_vi: 'x' }) });
    assert.equal(notAdmin.status, 403);

    const bad = await realFetch(`${base}/api/pois`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' }, body: JSON.stringify({ id: 'SAI ID', name_vi: 'x' }) });
    assert.equal(bad.status, 400);
  } finally {
    globalThis.fetch = realFetch;
    server.close();
  }
});

test('thiếu cấu hình Supabase thì báo lỗi rõ ràng thay vì sập', async () => {
  const app = createRealApp({});
  const server = http.createServer(app);
  const base = await listen(server);
  try {
    // không có cấu hình thì isAdmin trả false → 403 (không lộ chi tiết)
    const r = await fetch(`${base}/api/stats`, { headers: { Authorization: 'Bearer t' } });
    assert.equal(r.status, 403);
  } finally { server.close(); }
});
