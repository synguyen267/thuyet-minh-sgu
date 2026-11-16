import { fromSupabase } from '../errors.js';

const check = (error) => {
  if (error) throw fromSupabase(error);
};

/** Đọc các view thống kê: v_top_pois, v_avg_listen, v_heat và đếm bảng nhật ký. */
export function createStatsRepository(db) {
  return {
    async overview() {
      const [top, avg, plays, tracks, heat] = await Promise.all([
        db.from('v_top_pois').select('*'),
        db.from('v_avg_listen').select('*'),
        db.from('play_log').select('*', { count: 'exact', head: true }),
        db.from('location_track').select('*', { count: 'exact', head: true }),
        db.from('v_heat').select('*').order('hits', { ascending: false }).limit(10),
      ]);
      for (const r of [top, avg, plays, tracks, heat]) check(r.error);
      return { top: top.data, avg: avg.data, totalPlays: plays.count ?? 0, totalTracks: tracks.count ?? 0, heat: heat.data };
    },
    /** Supabase trả tối đa 1000 dòng mỗi lần nên đọc từng trang. */
    async heatCells(maxRows) {
      const rows = [];
      for (let from = 0; from < maxRows; from += 1000) {
        const { data, error } = await db
          .from('v_heat')
          .select('lat, lng, hits')
          .order('hits', { ascending: false })
          .order('lat')
          .order('lng')
          .range(from, from + 999);
        check(error);
        rows.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return rows.slice(0, maxRows);
    },
  };
}
