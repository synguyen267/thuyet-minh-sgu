import test from 'node:test';
import assert from 'node:assert/strict';
import { createStatsService } from '../services/stats.service.js';

test('bản đồ nhiệt: số ô tối đa bị kẹp từ 1 đến 5000', async () => {
  const seen = [];
  const s = createStatsService({ statsRepoFor: () => ({ heatCells: async (n) => { seen.push(n); return []; }, overview: async () => ({ ok: 1 }) }) });
  await s.heatCells('t', 999999);
  await s.heatCells('t', -5);
  await s.heatCells('t', 'abc');
  await s.heatCells('t', 200);
  assert.deepEqual(seen, [5000, 1, 5000, 200]);
  assert.deepEqual(await s.overview('t'), { ok: 1 });
});
