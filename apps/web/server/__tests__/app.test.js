import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import { HttpError } from '../errors.js';

const echo = (name) => async (req, res) => res.json({ result: { name, token: req.token, body: req.body, params: req.params, query: req.query } });
const controllers = {
  poi: {
    create: async (req, res) => res.status(201).json({ result: { token: req.token, body: req.body } }),
    update: echo('update'),
    saveTranslation: echo('saveTranslation'),
    plays: echo('plays'),
    remove: async () => { throw new HttpError(409, 'đang dùng'); },
  },
  ai: { draft: echo('draft'), translate: async () => { throw new Error('lỗi bất ngờ'); } },
  stats: { overview: echo('overview'), heat: echo('heat') },
};

async function withServer(fn) {
  const app = createApp({ isAdmin: async (t) => t === 'good', controllers });
  const server = await new Promise((res) => { const s = app.listen(0, () => res(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { await new Promise((r) => server.close(r)); }
}
const call = (base, path, { method = 'GET', token, body, raw } = {}) =>
  fetch(base + path, {
    method,
    headers: { ...(body !== undefined || raw ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });

test('health mở cho mọi người', () => withServer(async (b) => {
  const r = await call(b, '/api/health');
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ok, true);
}));

test('không có token thì 401, token không phải admin thì 403', () => withServer(async (b) => {
  assert.equal((await call(b, '/api/stats')).status, 401);
  const r = await call(b, '/api/stats', { token: 'bad' });
  assert.equal(r.status, 403);
  assert.match((await r.json()).error, /quản trị/);
}));

test('admin gọi được; token và nội dung JSON đến được controller', () => withServer(async (b) => {
  const r = await call(b, '/api/pois', { method: 'POST', token: 'good', body: { id: 'a', name_vi: 'A' } });
  assert.equal(r.status, 201);
  assert.deepEqual((await r.json()).result, { token: 'good', body: { id: 'a', name_vi: 'A' } });
}));

test('tham số đường dẫn và query được truyền đúng', () => withServer(async (b) => {
  const r = await call(b, '/api/pois/khu-a/translations/en', { method: 'PUT', token: 'good', body: { name: 'x' } });
  assert.deepEqual((await r.json()).result.params, { id: 'khu-a', lang: 'en' });
  const h = await call(b, '/api/stats/heat?max=200', { token: 'good' });
  assert.equal((await h.json()).result.query.max, '200');
}));

test('lỗi có mã HTTP được trả đúng mã; lỗi bất ngờ trả 500 không lộ chi tiết', () => withServer(async (b) => {
  const a = await call(b, '/api/pois/a', { method: 'DELETE', token: 'good' });
  assert.equal(a.status, 409);
  assert.equal((await a.json()).error, 'đang dùng');
  const origErr = console.error; console.error = () => {};
  try {
    const c = await call(b, '/api/ai/translate', { method: 'POST', token: 'good', body: {} });
    assert.equal(c.status, 500);
    assert.equal((await c.json()).error, 'Lỗi máy chủ.');
  } finally { console.error = origErr; }
}));

test('JSON hỏng thì 400; đường dẫn lạ thì 404 dạng JSON', () => withServer(async (b) => {
  const bad = await call(b, '/api/ai/draft', { method: 'POST', token: 'good', raw: '{không phải json' });
  assert.equal(bad.status, 400);
  const nf = await call(b, '/api/khong-co');
  assert.equal(nf.status, 404);
  assert.equal((await nf.json()).error, 'Không tìm thấy.');
}));

test('req.body đã được đọc sẵn (như trên Vercel) thì dùng luôn, không treo', () => withServer(async (b) => {
  const r = await call(b, '/api/ai/draft', { method: 'POST', token: 'good', body: { name: 'A' } });
  assert.equal(r.status, 200);
}));
