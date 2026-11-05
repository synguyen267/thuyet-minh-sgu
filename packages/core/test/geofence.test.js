import test from 'node:test';
import assert from 'node:assert/strict';
import { findCandidates, selectPoi, distancesTo } from '../src/index.js';

// 0.0001 độ vĩ ≈ 11,1 m
const at = (dLat) => ({ lat: 10.76 + dLat, lng: 106.68, accuracy: 8 });
const poi = (id, dLat, extra = {}) => ({ id, lat: 10.76 + dLat, lng: 106.68, radius_m: 20, priority: 1, ...extra });

test('ngoài mọi vùng thì không chọn điểm nào', () => {
  assert.equal(selectPoi(at(0), [poi('a', 0.001)]), null);
});

test('trong vùng thì chọn điểm đó', () => {
  assert.equal(selectPoi(at(0), [poi('a', 0.0001)]).poi.id, 'a');
});

test('nhiều điểm: ưu tiên cao thắng điểm gần hơn', () => {
  const r = selectPoi(at(0), [poi('gan', 0.00005, { priority: 1 }), poi('uutien', 0.00012, { priority: 3 })]);
  assert.equal(r.poi.id, 'uutien');
});

test('bằng ưu tiên: chọn điểm gần hơn', () => {
  const r = selectPoi(at(0), [poi('xa', 0.00015), poi('gan', 0.00005)]);
  assert.equal(r.poi.id, 'gan');
});

test('bỏ qua điểm bị ẩn và điểm chưa có tọa độ', () => {
  const r = selectPoi(at(0), [poi('an', 0, { is_active: false }), { id: 'chua', lat: null, lng: null, radius_m: 20 }]);
  assert.equal(r, null);
});

test('vị trí kém chính xác (> 60 m) bị bỏ qua', () => {
  const pos = { ...at(0), accuracy: 120 };
  assert.deepEqual(findCandidates(pos, [poi('a', 0)]), []);
});

test('hệ số bán kính (độ nhạy GPS) mở rộng vùng', () => {
  const p = poi('a', 0.00035); // ~38,9 m, bán kính 20 m
  assert.equal(selectPoi(at(0), [p]), null);
  assert.equal(selectPoi(at(0), [p], { radiusScale: 2 }).poi.id, 'a');
});

test('distancesTo sắp gần nhất trước và bỏ điểm không có tọa độ', () => {
  const list = distancesTo(at(0), [poi('xa', 0.001), poi('gan', 0.0001), { id: 'x', lat: null, lng: null }]);
  assert.deepEqual(list.map((x) => x.poi.id), ['gan', 'xa']);
});
