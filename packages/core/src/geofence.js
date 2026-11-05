import { haversineMeters, hasCoords } from './geo.js';

/**
 * Các điểm đang nằm trong bán kính, đã sắp xếp: ưu tiên cao trước, bằng nhau thì gần hơn trước.
 * pois: [{ id, lat, lng, radius_m, priority?, is_active? }]
 * pos:  { lat, lng, accuracy? }
 * options.radiusScale: hệ số nhân bán kính (độ nhạy GPS, mặc định 1)
 * options.maxAccuracyM: bỏ qua vị trí kém chính xác hơn mức này (mặc định 60 m)
 */
export function findCandidates(pos, pois, { radiusScale = 1, maxAccuracyM = 60 } = {}) {
  if (!hasCoords(pos)) return [];
  if (Number.isFinite(pos.accuracy) && pos.accuracy > maxAccuracyM) return [];
  return (pois ?? [])
    .filter((p) => p.is_active !== false && hasCoords(p))
    .map((poi) => ({ poi, distance: haversineMeters(pos, poi) }))
    .filter((c) => c.distance <= (c.poi.radius_m ?? 20) * radiusScale)
    .sort(
      (a, b) =>
        (b.poi.priority ?? 0) - (a.poi.priority ?? 0) || a.distance - b.distance
    );
}

/** Điểm được chọn để thuyết minh (hoặc null nếu ngoài mọi vùng). */
export function selectPoi(pos, pois, options) {
  return findCandidates(pos, pois, options)[0] ?? null;
}

/** Khoảng cách tới mọi điểm có tọa độ, gần nhất trước (dùng cho danh sách điểm). */
export function distancesTo(pos, pois) {
  if (!hasCoords(pos)) return [];
  return (pois ?? [])
    .filter(hasCoords)
    .map((poi) => ({ poi, distance: haversineMeters(pos, poi) }))
    .sort((a, b) => a.distance - b.distance);
}
