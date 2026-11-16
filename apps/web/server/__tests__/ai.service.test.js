import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiService } from '../services/ai.service.js';
import { createGemini } from '../lib/gemini.js';
import { HttpError } from '../errors.js';

test('soạn nháp: gửi tên và ý chính, trả về text đã cắt khoảng trắng', async () => {
  let seen;
  const ai = createAiService({ gemini: { generateJson: async (sys, user) => { seen = { sys, user }; return { text: '  Xin chào  ' }; } } });
  assert.deepEqual(await ai.draft({ name: 'Khu A', notes: 'giảng đường' }), { text: 'Xin chào' });
  assert.match(seen.user, /Khu A/);
  assert.match(seen.user, /giảng đường/);
  assert.match(seen.sys, /không bịa/i);
});

test('soạn nháp: thiếu tên thì 400, AI trả rỗng thì 502', async () => {
  const empty = createAiService({ gemini: { generateJson: async () => ({ text: '' }) } });
  await assert.rejects(empty.draft({ name: '' }), (e) => e.status === 400);
  await assert.rejects(empty.draft({ name: 'A' }), (e) => e.status === 502);
});

test('dịch: mỗi ngôn ngữ một yêu cầu chạy song song, bỏ vi và mã lạ', async () => {
  let calls = 0;
  const gemini = {
    generateJson: async (sys) => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 100));
      const lang = ['English', 'Chinese', 'Japanese', 'Korean'].find((l) => sys.includes(l));
      return { name: `N-${lang}`, text: `T-${lang}` };
    },
  };
  const t0 = Date.now();
  const r = await createAiService({ gemini }).translate({ name: 'Khu A', text: 'Xin chào', targets: ['en', 'zh', 'ja', 'ko', 'vi', 'xx'] });
  assert.equal(calls, 4);
  assert.deepEqual(Object.keys(r).sort(), ['en', 'ja', 'ko', 'zh']);
  assert.equal(r.ja.name, 'N-Japanese');
  assert.ok(Date.now() - t0 < 300, 'phải chạy song song');
});

test('dịch: thiếu bản dịch thì 502; không chọn ngôn ngữ thì 400', async () => {
  const bad = createAiService({ gemini: { generateJson: async () => ({ name: 'A', text: '' }) } });
  await assert.rejects(bad.translate({ name: 'A', text: 'x', targets: ['en'] }), (e) => e instanceof HttpError && e.status === 502);
  await assert.rejects(bad.translate({ name: 'A', text: 'x', targets: ['vi'] }), (e) => e.status === 400);
});

test('gemini: model không nhận thinking thì thử lại không có; lỗi 503 thì thử lại một lần; đọc được JSON trong rào ```', async () => {
  const bodies = [];
  const replies = [
    { ok: false, status: 400, json: async () => ({ error: { message: 'bad' } }) },
    { ok: false, status: 503, json: async () => ({}) },
    { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '```json\n{"a":1}\n```' }] } }] }) },
  ];
  const g = createGemini({ apiKey: 'k', model: 'm', retryDelayMs: 1, fetchFn: async (url, opts) => { bodies.push(JSON.parse(opts.body)); return replies.shift(); } });
  assert.deepEqual(await g.generateJson('s', 'u'), { a: 1 });
  assert.equal(bodies.length, 3);
  assert.ok(bodies[0].generationConfig.thinkingConfig);
  assert.ok(!bodies[1].generationConfig.thinkingConfig);
});

test('gemini: thiếu khóa thì báo 500 rõ ràng', async () => {
  const g = createGemini({ apiKey: undefined, model: 'm' });
  await assert.rejects(g.generateJson('s', 'u'), (e) => e.status === 500 && /GEMINI_API_KEY/.test(e.message));
});
