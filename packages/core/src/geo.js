// Hàm địa lý thuần, không phụ thuộc trình duyệt: chạy được trên web, React Native và Node.
const EARTH_RADIUS_M = 6371008.8;
const toRad = (d) => (d * Math.PI) / 180;

/** Điểm có tọa độ hợp lệ (lat, lng là số hữu hạn). */
export function hasCoords(p) {
  return Number.isFinite(p?.lat) && Number.isFinite(p?.lng);
}

/** Khoảng cách theo mét giữa hai điểm {lat, lng} (công thức haversine). */
export function haversineMeters(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Bộ lọc di chuyển: chỉ nhận vị trí mới khi đã đi được ít nhất minMoveM mét. */
export function createMovementFilter(minMoveM = 5) {
  let last = null;
  return (pos) => {
    if (!hasCoords(pos)) return false;
    if (!last || haversineMeters(last, pos) >= minMoveM) {
      last = { lat: pos.lat, lng: pos.lng };
      return true;
    }
    return false;
  };
}

function median(values) {
  const v = [...values].sort((x, y) => x - y);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/**
 * Gộp nhiều mẫu GPS thành một tọa độ (trung bình có trọng số 1/accuracy²).
 * Dùng khi đo tọa độ điểm tại chỗ. Trả về null nếu không có mẫu hợp lệ.
 */
export function averageFixes(fixes) {
  const valid = (fixes ?? []).filter(hasCoords);
  if (valid.length === 0) return null;
  let sw = 0, sLat = 0, sLng = 0;
  for (const f of valid) {
    const acc = Number.isFinite(f.accuracy) && f.accuracy > 0 ? f.accuracy : 50;
    const w = 1 / (acc * acc);
    sw += w; sLat += f.lat * w; sLng += f.lng * w;
  }
  const accs = valid.map((f) => (Number.isFinite(f.accuracy) ? f.accuracy : 50));
  return {
    lat: sLat / sw,
    lng: sLng / sw,
    accuracy_m: Math.round(median(accs) * 10) / 10,
    samples: valid.length,
  };
}
