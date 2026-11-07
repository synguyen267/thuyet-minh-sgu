import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { poiName, zonesOf } from '@tm/core';

// Chỉ dùng để mở bản đồ khi chưa điểm nào có tọa độ (khu vực quận 5), không phải tọa độ điểm.
const FALLBACK_CENTER = [10.7598, 106.682];

/** Bản đồ Leaflet + OpenStreetMap: các điểm đánh số theo tuyến, vòng bán kính, vị trí người dùng. */
export default function MapView({ pois, pos, selectedId, scale = 1, lang = 'vi', onSelect }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const fitted = useRef(false);

  useEffect(() => {
    const m = L.map(el.current).setView(FALLBACK_CENTER, 17);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; layer.current = null; fitted.current = false; };
  }, []);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    const points = [];
    for (const p of pois) {
      const zones = zonesOf(p);
      if (zones.length === 0) continue;
      const sel = p.id === selectedId;
      zones.forEach((z, k) => {
        L.circle([z.lat, z.lng], {
          radius: z.radius_m * scale,
          color: sel ? '#0b6b74' : '#6b7f8a',
          weight: sel ? 3 : 1,
          fillOpacity: sel ? 0.18 : 0.07,
        }).addTo(g);
        points.push([z.lat, z.lng]);
        if (k > 0) L.circleMarker([z.lat, z.lng], { radius: 4, color: '#fff', weight: 1, fillColor: sel ? '#0b6b74' : '#5b6b75', fillOpacity: 1 }).addTo(g);
      });
      const main = zones[0];
      const pin = L.marker([main.lat, main.lng], {
        icon: L.divIcon({ className: `poi-pin${sel ? ' sel' : ''}`, html: `<span>${p.tour_order ?? ''}</span>`, iconSize: [28, 28] }),
        title: poiName(p, lang),
      });
      pin.on('click', () => onSelect?.(p.id));
      pin.addTo(g);
    }
    if (pos) {
      L.circle([pos.lat, pos.lng], { radius: Math.max(pos.accuracy ?? 0, 3), color: '#2563eb', weight: 1, fillOpacity: 0.1 }).addTo(g);
      L.circleMarker([pos.lat, pos.lng], { radius: 7, color: '#ffffff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 }).addTo(g);
    }
    if (!fitted.current && points.length && map.current) {
      map.current.fitBounds(points, { padding: [30, 30], maxZoom: 18 });
      fitted.current = true;
    }
  }, [pois, pos, selectedId, scale, lang, onSelect]);

  return <div className="map" ref={el} role="application" aria-label="Bản đồ khuôn viên" />;
}
