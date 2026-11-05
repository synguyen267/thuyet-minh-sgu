import test from 'node:test';
import assert from 'node:assert/strict';
import { NarrationController } from '../src/index.js';

function make(cooldownMs = 10 * 60 * 1000) {
  let t = 0;
  const c = new NarrationController({ cooldownMs, now: () => t });
  return { c, advance: (ms) => { t += ms; } };
}

test('rảnh thì phát ngay', () => {
  const { c } = make();
  assert.deepEqual(c.request('a'), { action: 'play', id: 'a', source: 'gps' });
});

test('đang phát thì điểm thứ hai xếp hàng, phát xong mới đọc (không chồng giọng)', () => {
  const { c } = make();
  c.request('a');
  assert.equal(c.request('b').action, 'queued');
  assert.deepEqual(c.finish(), { action: 'play', id: 'b', source: 'gps' });
  assert.equal(c.finish().action, 'idle');
});

test('điểm đang phát hoặc đang chờ thì bỏ qua', () => {
  const { c } = make();
  c.request('a'); c.request('b');
  assert.deepEqual(c.request('a'), { action: 'skip', reason: 'playing' });
  assert.deepEqual(c.request('b'), { action: 'skip', reason: 'queued' });
});

test('không đọc lặp trong thời gian chờ, hết thời gian thì đọc lại', () => {
  const { c, advance } = make(10 * 60 * 1000);
  c.request('a'); c.finish();
  advance(5 * 60 * 1000);
  assert.deepEqual(c.request('a'), { action: 'skip', reason: 'cooldown' });
  advance(6 * 60 * 1000);
  assert.equal(c.request('a').action, 'play');
});

test('QR phát ngay, bỏ qua thời gian chờ và ngắt điểm đang phát', () => {
  const { c } = make();
  c.request('a');
  const r = c.request('a', { source: 'qr' });
  assert.equal(r.action, 'play');
  assert.equal(r.preempted, 'a');
  c.request('b', { source: 'gps' });
  const q = c.request('c', { source: 'qr' });
  assert.equal(q.preempted, 'a');
});

test('FR-22: gián đoạn rồi nghe tiếp thì phát lại điểm đang dở', () => {
  const { c } = make();
  c.request('a');
  assert.deepEqual(c.interrupt(), { action: 'pause', id: 'a' });
  assert.equal(c.request('b').action, 'queued'); // không tự phát chồng khi đang bị ngắt
  assert.deepEqual(c.resume(), { action: 'play', id: 'a', resumed: true });
});

test('FR-22: gián đoạn rồi bỏ qua thì sang điểm kế tiếp', () => {
  const { c } = make();
  c.request('a'); c.request('b');
  c.interrupt();
  assert.deepEqual(c.dismiss(), { action: 'play', id: 'b', source: 'gps' });
});

test('reset xóa hết trạng thái', () => {
  const { c } = make();
  c.request('a'); c.request('b');
  c.reset();
  assert.deepEqual(c.snapshot(), { current: null, queue: [], paused: false });
  assert.equal(c.request('a').action, 'play');
});
