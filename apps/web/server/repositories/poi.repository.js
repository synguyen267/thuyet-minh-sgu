import { fromSupabase, notFound } from '../errors.js';

const check = (error) => {
  if (error) throw fromSupabase(error);
};

/** Truy cập bảng poi, poi_translation và đếm lượt nghe. db là client Supabase mang token người gọi. */
export function createPoiRepository(db) {
  return {
    async insertPoi(row) {
      check((await db.from('poi').insert(row)).error);
    },
    async updatePoi(id, fields) {
      const { data, error } = await db.from('poi').update(fields).eq('id', id).select('id');
      check(error);
      if (!data?.length) throw notFound('Không tìm thấy điểm này.');
    },
    async deletePoi(id) {
      const { data, error } = await db.from('poi').delete().eq('id', id).select('id');
      check(error);
      if (!data?.length) throw notFound('Không tìm thấy điểm này.');
    },
    async insertTranslation(row) {
      check((await db.from('poi_translation').insert(row)).error);
    },
    async upsertTranslation(row) {
      check((await db.from('poi_translation').upsert(row, { onConflict: 'poi_id,lang' })).error);
    },
    async countPlays(id) {
      const { count, error } = await db.from('play_log').select('*', { count: 'exact', head: true }).eq('poi_id', id);
      check(error);
      return count ?? 0;
    },
  };
}
