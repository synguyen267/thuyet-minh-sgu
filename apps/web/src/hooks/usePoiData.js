import { useCallback, useEffect, useState } from 'react';
import { loadPois } from '../data/repo.js';

/** Danh sách điểm từ Supabase (có dự phòng dữ liệu mẫu). */
export function usePoiData() {
  const [state, setState] = useState({ pois: [], source: null, loading: true, error: null });
  const reload = useCallback(async () => {
    const r = await loadPois();
    setState({ ...r, loading: false });
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}
