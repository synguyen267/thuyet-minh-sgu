import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { poiName, zonesOf } from '@tm/core';

// Chỉ dùng để mở bản đồ khi chưa có dữ liệu nào (khu vực quận 5).
const FALLBACK_CENTER = [10.7598, 106.682];
const DECIMALS = 4; // gộp các ô 5 chữ số thập phân (khoảng 1 m) thành ô khoảng 11 m cho dễ nhìn
const CELL_RADIUS_M = 9;

/** Màu theo mức độ t từ 0 đến 1: vàng, cam rồi đỏ. */
function heatColor(t) {
  return `hsl(${Math.round(55 - 55 * t)}, 95%, ${Math.round(55 - 10 * t)}%)`;
}

/** Bản đồ nhiệt: chỗ nào khách đứng nhiều thì đậm và đỏ hơn. cells là các dòng { lat, lng, hits } của view v_heat. */
export default function HeatMap({ cells = [], pois = [] }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const fitted = useRef(false);

  // Gộp ô nhỏ thành ô lớn rồi tính mức cao nhất để chia thang màu
  const grid = useMemo(() => {
    const merged = new Map();
    let total = 0;
    for (const c of cells) {
      const lat = Number(c.lat), lng = Number(c.lng), hits = Number(c.hits) || 0;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const la = Number(lat.toFixed(DECIMALS)), ln = Number(lng.toFixed(DECIMALS));
      const key = `${la},${ln}`;
      const cur = merged.get(key) ?? { lat: la, lng: ln, hits: 0 };
      cur.hits += hits;
      merged.set(key, cur);
      total += hits;
    }
    const list = [...merged.values()];
    const max = list.reduce((m, c) => Math.max(m, c.hits), 0);
    return { list, max, total };
  }, [cells]);

  const hasData = grid.list.length > 0;

  useEffect(() => {
    if (!hasData || !el.current) return undefined;
    const m = L.map(el.current, { preferCanvas: true }).setView(FALLBACK_CENTER, 17);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; layer.current = null; fitted.current = false; };
  }, [hasData]);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    const points = [];
    for (const c of grid.list) {
      const t = grid.max > 0 ? Math.sqrt(c.hits / grid.max) : 0; // căn bậc hai để ô ít lượt vẫn nhìn thấy
      L.circle([c.lat, c.lng], {
        radius: CELL_RADIUS_M,
        stroke: false,
        fillColor: heatColor(t),
        fillOpacity: 0.3 + 0.45 * t,
      }).bindTooltip(`${c.hits} lần`, { direction: 'top' }).addTo(g);
      points.push([c.lat, c.lng]);
    }
    // Chấm xanh đánh dấu các điểm thuyết minh để dễ đối chiếu với vùng đỏ
    for (const p of pois) {
      const z = zonesOf(p)[0];
      if (!z) continue;
      L.circleMarker([z.lat, z.lng], { radius: 5, color: '#ffffff', weight: 2, fillColor: '#0b6b74', fillOpacity: 1 })
        .bindTooltip(poiName(p), { direction: 'top' })
        .addTo(g);
    }
    if (!fitted.current && points.length && map.current) {
      map.current.fitBounds(points, { padding: [30, 30], maxZoom: 19 });
      fitted.current = true;
    }
  }, [grid, pois, hasData]);

  if (!hasData) return <p className="note">Chưa có dữ liệu vị trí để vẽ bản đồ nhiệt.</p>;

  return (
    <>
      <div ref={el} style={{ height: 360, borderRadius: 12 }} role="application" aria-label="Bản đồ nhiệt: nơi khách hay đứng" />
      <p className="note">
        Càng đỏ càng nhiều lượt (cao nhất {grid.max} lần trong một ô khoảng 11 m, tổng {grid.total} điểm vị trí). Chấm xanh là các điểm thuyết minh.
      </p>
    </>
  );
}
