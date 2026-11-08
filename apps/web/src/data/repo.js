import sample from '@tm/core/data/pois.sample.json';
import { sortByTour, shapePoiRow } from '@tm/core';
import { supabase } from '../supabase.js';

function sampleResult(error) {
  const pois = sortByTour(sample.pois.map((p) => ({ ...p, audio: {}, status: {}, description: {} })));
  return { pois, source: 'sample', error: error ?? null };
}

/**
 * Tải điểm từ Supabase (RLS tự quyết định thấy gì: khách thấy bản đã duyệt, admin thấy tất cả).
 * Lỗi mạng hoặc CSDL trống thì dùng dữ liệu mẫu trong repo để trang không bị trắng.
 */
export async function loadPois() {
  if (!supabase) return sampleResult('Chưa cấu hình Supabase');
  try {
    const { data, error } = await supabase
      .from('poi')
      .select('*, poi_translation(*)')
      .order('tour_order', { ascending: true });
    if (error) return sampleResult(error.message);
    if (!data?.length) return sampleResult('CSDL chưa có điểm nào');
    return { pois: sortByTour(data.map(shapePoiRow)), source: 'supabase', error: null };
  } catch (e) {
    return sampleResult(e.message);
  }
}

// ---------- Phiên ẩn danh ----------
export function getSessionId() {
  try {
    let id = localStorage.getItem('tm.session');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('tm.session', id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

// ---------- Ghi nhật ký (lỗi thì bỏ qua, không làm hỏng trải nghiệm) ----------
export async function logPlay({ poi_id, lang, source, lat, lng, duration_s, completed }) {
  if (!supabase) return;
  try {
    await supabase.from('play_log').insert({
      session_id: getSessionId(),
      poi_id,
      lang,
      trigger_source: ['gps', 'qr', 'manual'].includes(source) ? source : 'manual',
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      duration_s: Math.max(0, Math.min(3600, duration_s ?? 0)),
      completed: Boolean(completed),
    });
  } catch { /* bỏ qua */ }
}

export async function logTrack(pos) {
  if (!supabase || !pos) return;
  try {
    await supabase.from('location_track').insert({
      session_id: getSessionId(),
      lat: pos.lat,
      lng: pos.lng,
      accuracy_m: Number.isFinite(pos.accuracy) ? Math.min(5000, pos.accuracy) : null,
    });
  } catch { /* bỏ qua */ }
}

// ---------- Quản trị (chỉ thành công khi đăng nhập bằng tài khoản admin) ----------
function check(error) {
  if (error) throw new Error(error.message);
}

export async function savePoi(id, fields) {
  const { error } = await supabase.from('poi').update(fields).eq('id', id);
  check(error);
}

export async function saveTranslation(poi_id, lang, fields) {
  const { error } = await supabase
    .from('poi_translation')
    .upsert({ poi_id, lang, ...fields }, { onConflict: 'poi_id,lang' });
  check(error);
}

export async function fetchStats() {
  const [top, avg, plays, tracks, heat] = await Promise.all([
    supabase.from('v_top_pois').select('*'),
    supabase.from('v_avg_listen').select('*'),
    supabase.from('play_log').select('*', { count: 'exact', head: true }),
    supabase.from('location_track').select('*', { count: 'exact', head: true }),
    supabase.from('v_heat').select('*').order('hits', { ascending: false }).limit(10),
  ]);
  for (const r of [top, avg, plays, tracks, heat]) check(r.error);
  return { top: top.data, avg: avg.data, totalPlays: plays.count ?? 0, totalTracks: tracks.count ?? 0, heat: heat.data };
}

// ---------- Thêm / xóa điểm (quản trị) ----------
/** Tạo điểm mới ở trạng thái ẨN (khách chưa thấy) kèm tên tiếng Việt dạng bản nháp. */
export async function createPoi({ id, name_vi, tour_order, radius_m, priority }) {
  const { error } = await supabase.from('poi').insert({ id, tour_order, radius_m, priority, is_active: false });
  check(error);
  const { error: e2 } = await supabase
    .from('poi_translation')
    .insert({ poi_id: id, lang: 'vi', name: name_vi, status: 'draft', source: 'human' });
  if (e2) {
    await supabase.from('poi').delete().eq('id', id); // hoàn tác để không để lại điểm mồ côi
    check(e2);
  }
}

export async function countPlays(id) {
  const { count, error } = await supabase.from('play_log').select('*', { count: 'exact', head: true }).eq('poi_id', id);
  check(error);
  return count ?? 0;
}

export async function deletePoi(id) {
  const { error } = await supabase.from('poi').delete().eq('id', id);
  check(error);
}
