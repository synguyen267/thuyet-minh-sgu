import { useCallback, useEffect, useMemo, useState } from 'react';
import { sortByTour } from '@tm/core';
import sample from '@tm/core/data/pois.sample.json';

const KEY = 'tm.measured.v1';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

/** Dữ liệu điểm mẫu, ghi đè tọa độ bằng các lần đo đã lưu trên máy này. */
export function usePois() {
  const [measured, setMeasured] = useState(() => (typeof window === 'undefined' ? {} : read()));

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(measured)); } catch { /* bỏ qua */ }
  }, [measured]);

  const pois = useMemo(
    () =>
      sortByTour(sample.pois).map((p) => {
        const m = measured[p.id];
        return m ? { ...p, lat: m.lat, lng: m.lng, measured: m } : p;
      }),
    [measured]
  );

  const save = useCallback(
    (id, fix) => setMeasured((s) => ({ ...s, [id]: { ...fix, at: new Date().toISOString() } })),
    []
  );
  const clear = useCallback(() => setMeasured({}), []);

  const exportJson = useCallback(
    () =>
      JSON.stringify(
        pois.map((p) => ({
          id: p.id,
          lat: p.lat === null ? null : Number(p.lat.toFixed(6)),
          lng: p.lng === null ? null : Number(p.lng.toFixed(6)),
          accuracy_m: p.measured?.accuracy_m ?? null,
        })),
        null,
        2
      ),
    [pois]
  );

  return { pois, save, clear, exportJson };
}
