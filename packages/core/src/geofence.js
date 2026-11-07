import { haversineMeters, hasCoords } from './geo.js';

/**
 * Các vùng kích hoạt của một điểm: vùng chính (lat, lng, radius_m) cộng các vùng phụ (extra_zones).
 * Khu dài như Khu A nên đặt nhiều vùng nhỏ dọc theo khu, thay vì một vòng tròn rất to
 * (vòng to sẽ lấn sang khu bên cạnh).
 */
export function zonesOf(poi) {
  const base = Number.isFinite(poi?.radius_m) ? poi.radius_m : 20;
  const zones = [];
  if (hasCoords(poi)) zones.push({ lat: poi.lat, lng: poi.lng, radius_m: base });
  if (Array.isArray(poi?.extra_zones)) {
    for (const z of poi.extra_zones) {
      if (hasCoords(z)) zones.push({ lat: z.lat, lng: z.lng, radius_m: Number.isFinite(z.radius_m) ? z.radius_m : base });
    }
  }
  return zones;
}

/** Điểm có ít nhất một vùng có tọa độ. */
export function hasZones(poi) {
  return zonesOf(poi).length > 0;
}

/**
 * Các điểm đang nằm trong bán kính của ÍT NHẤT MỘT vùng, đã sắp xếp: ưu tiên cao trước,
 * bằng nhau thì gần hơn trước. Khoảng cách của điểm là khoảng cách tới vùng gần nhất đang chứa người dùng.
 * pois: [{ id, lat, lng, radius_m, extra_zones?, priority?, is_active? }]
 * pos:  { lat, lng, accuracy? }
 * options.radiusScale: hệ số nhân bán kính (độ nhạy GPS, mặc định 1)
 * options.maxAccuracyM: bỏ qua vị trí kém chính xác hơn mức này (mặc định 60 m)
 */
export function findCandidates(pos, pois, { radiusScale = 1, maxAccuracyM = 60 } = {}) {
  if (!hasCoords(pos)) return [];
  if (Number.isFinite(pos.accuracy) && pos.accuracy > maxAccuracyM) return [];
  const out = [];
  for (const poi of pois ?? []) {
    if (poi.is_active === false) continue;
    let best = null;
    for (const z of zonesOf(poi)) {
      const d = haversineMeters(pos, z);
      if (d <= z.radius_m * radiusScale && (best === null || d < best)) best = d;
    }
    if (best !== null) out.push({ poi, distance: best });
  }
  return out.sort(
    (a, b) => (b.poi.priority ?? 0) - (a.poi.priority ?? 0) || a.distance - b.distance
  );
}

/** Điểm được chọn để thuyết minh (hoặc null nếu ngoài mọi vùng). */
export function selectPoi(pos, pois, options) {
  return findCandidates(pos, pois, options)[0] ?? null;
}

/** Khoảng cách tới vùng gần nhất của mỗi điểm có tọa độ, gần nhất trước (dùng cho danh sách điểm). */
export function distancesTo(pos, pois) {
  if (!hasCoords(pos)) return [];
  const out = [];
  for (const poi of pois ?? []) {
    const zones = zonesOf(poi);
    if (zones.length === 0) continue;
    out.push({ poi, distance: Math.min(...zones.map((z) => haversineMeters(pos, z))) });
  }
  return out.sort((a, b) => a.distance - b.distance);
}
