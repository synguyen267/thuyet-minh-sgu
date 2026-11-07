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

// ---- Khu dài: nhiều vùng cho một điểm ----
import { zonesOf, hasZones } from '../src/index.js';

// 0.0003 độ kinh ≈ 33 m ở vĩ độ này
const longBuilding = {
  id: 'khu-a', lat: 10.76, lng: 106.680, radius_m: 20, priority: 1,
  extra_zones: [{ lat: 10.76, lng: 106.6803, radius_m: 20 }, { lat: 10.76, lng: 106.6806, radius_m: 20 }],
};
const atLng = (lng) => ({ lat: 10.76, lng, accuracy: 8 });

test('zonesOf: vùng chính cộng vùng phụ, vùng phụ thiếu bán kính thì dùng bán kính chính', () => {
  const z = zonesOf({ ...longBuilding, extra_zones: [{ lat: 10.76, lng: 106.681 }] });
  assert.equal(z.length, 2);
  assert.equal(z[1].radius_m, 20);
});

test('zonesOf: điểm chưa đo vùng chính nhưng có vùng phụ vẫn có vùng', () => {
  assert.equal(hasZones({ id: 'x', lat: null, lng: null, extra_zones: [{ lat: 10, lng: 106, radius_m: 20 }] }), true);
  assert.equal(hasZones({ id: 'x', lat: null, lng: null }), false);
});

test('khu dài: đứng gần đầu mút phụ vẫn được chọn, đứng xa mọi vùng thì không', () => {
  assert.equal(selectPoi(atLng(106.6806), [longBuilding]).poi.id, 'khu-a'); // gần vùng phụ thứ hai
  assert.equal(selectPoi(atLng(106.680), [longBuilding]).poi.id, 'khu-a'); // vùng chính
  assert.equal(selectPoi(atLng(106.6830), [longBuilding]), null); // ~330 m
});

test('nhiều vùng: khoảng cách ứng viên là vùng gần nhất đang chứa người dùng', () => {
  const r = selectPoi(atLng(106.6805), [longBuilding]);
  assert.ok(r.distance < 12, `khoảng cách ${r.distance}`); // gần vùng phụ thứ hai (~5,5 m)
});

test('hai khu cạnh nhau: vùng phụ của khu dài không cướp điểm của khu kế bên khi đứng gần khu kế bên hơn', () => {
  const neighbor = { id: 'khu-b', lat: 10.76, lng: 106.6807, radius_m: 20, priority: 1 };
  assert.equal(selectPoi(atLng(106.6808), [longBuilding, neighbor]).poi.id, 'khu-b');
});

test('distancesTo dùng vùng gần nhất', () => {
  const [d] = distancesTo(atLng(106.6806), [longBuilding]);
  assert.ok(d.distance < 5);
});
