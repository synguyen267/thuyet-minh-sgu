import test from 'node:test';
import assert from 'node:assert/strict';
import { sortByTour, nextStop } from '../src/index.js';

const pois = [
  { id: 'c', tour_order: 3 },
  { id: 'a', tour_order: 1 },
  { id: 'x' },
  { id: 'b', tour_order: 2 },
];

test('sortByTour theo tour_order, điểm không có thứ tự xếp cuối', () => {
  assert.deepEqual(sortByTour(pois).map((p) => p.id), ['a', 'b', 'c', 'x']);
});

test('nextStop trả điểm đầu tiên chưa nghe', () => {
  assert.equal(nextStop(pois, []).id, 'a');
  assert.equal(nextStop(pois, ['a', 'b']).id, 'c');
  assert.equal(nextStop(pois, ['a', 'b', 'c', 'x']), null);
});
