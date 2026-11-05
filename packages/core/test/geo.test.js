import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineMeters, hasCoords, createMovementFilter, averageFixes } from '../src/index.js';

test('haversine: 1 độ vĩ độ xấp xỉ 111,2 km', () => {
  const d = haversineMeters({ lat: 10, lng: 106 }, { lat: 11, lng: 106 });
  assert.ok(Math.abs(d - 111195) < 200);
});

test('haversine: cùng điểm cho 0', () => {
  assert.equal(haversineMeters({ lat: 10.76, lng: 106.68 }, { lat: 10.76, lng: 106.68 }), 0);
});

test('hasCoords từ chối null và NaN', () => {
  assert.equal(hasCoords({ lat: null, lng: null }), false);
  assert.equal(hasCoords({ lat: NaN, lng: 1 }), false);
  assert.equal(hasCoords({ lat: 10.7, lng: 106.6 }), true);
});

test('bộ lọc di chuyển: nhận mẫu đầu, bỏ mẫu < 5 m, nhận mẫu >= 5 m', () => {
  const f = createMovementFilter(5);
  const base = { lat: 10.76, lng: 106.68 };
  assert.equal(f(base), true);
  assert.equal(f({ lat: base.lat + 0.00002, lng: base.lng }), false); // ~2,2 m
  assert.equal(f({ lat: base.lat + 0.00008, lng: base.lng }), true); // ~8,9 m
});

test('averageFixes: ưu tiên mẫu chính xác hơn', () => {
  const r = averageFixes([
    { lat: 10.0, lng: 106.0, accuracy: 5 },
    { lat: 10.001, lng: 106.0, accuracy: 50 },
  ]);
  assert.ok(r.lat < 10.0002); // gần mẫu 5 m hơn nhiều
  assert.equal(r.samples, 2);
});

test('averageFixes: không có mẫu hợp lệ thì null', () => {
  assert.equal(averageFixes([]), null);
  assert.equal(averageFixes([{ lat: null, lng: null }]), null);
});
