import sample from '@tm/core/data/pois.sample.json';
import { sortByTour, shapePoiRow } from '@tm/core';
import { supabase } from '../supabase.js';
import { readAll, putMany, removeMany } from './offlineStore.js';

function sampleResult(error) {
  const pois = sortByTour(sample.pois.map((p) => ({ ...p, audio: {}, status: {}, description: {} })));
  return { pois, source: 'sample', error: error ?? null };
}

/** Dấu vân tay của một điểm: đổi khi điểm hoặc bất kỳ bản dịch nào được sửa (so theo updated_at). */
function sigOf(r) {
  const tr = r.poi_translation ?? [];
  const latest = tr.reduce((m, t) => ((t.updated_at ?? '') > m ? t.updated_at : m), '');
  return `${r.updated_at ?? ''}|${tr.length}|${latest}`;
}

/** Tải toàn bộ điểm (dùng khi không so sánh được theo updated_at) rồi lưu lại trên máy. */
async function fullFetch() {
  const { data, error } = await supabase
    .from('poi')
    .select('*, poi_translation(*)')
    .order('tour_order', { ascending: true });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  await putMany(rows.map((r) => ({ id: r.id, sig: sigOf(r), row: r })));
  const remote = new Set(rows.map((r) => r.id));
  const stale = (await readAll()).filter((r) => !remote.has(r.id)).map((r) => r.id);
  if (stale.length) await removeMany(stale);
  return rows;
}

/**
 * Đồng bộ theo updated_at (FR-14, BR-10): hỏi server danh sách nhẹ (id + mốc cập nhật),
 * chỉ tải đầy đủ các điểm mới hoặc đã sửa, bỏ khỏi máy các điểm đã ẩn hoặc xóa.
 * Trả về danh sách điểm thô đã đồng bộ.
 */
async function syncFromServer() {
  const { data: stamps, error } = await supabase
    .from('poi')
    .select('id, updated_at, poi_translation(updated_at)')
    .order('tour_order', { ascending: true });
  if (error) return fullFetch(); // không so sánh được thì tải hết như trước

  const local = await readAll();
  const localById = new Map(local.map((r) => [r.id, r]));
  const remoteIds = new Set(stamps.map((s) => s.id));
  const changed = stamps.filter((s) => localById.get(s.id)?.sig !== sigOf(s)).map((s) => s.id);
  const removed = local.filter((r) => !remoteIds.has(r.id)).map((r) => r.id);

  let fetched = [];
  if (changed.length) {
    const { data, error: e2 } = await supabase
      .from('poi')
      .select('*, poi_translation(*)')
      .in('id', changed);
    if (e2) throw new Error(e2.message);
    fetched = data ?? [];
    await putMany(fetched.map((r) => ({ id: r.id, sig: sigOf(r), row: r })));
  }
  if (removed.length) await removeMany(removed);

  const fetchedById = new Map(fetched.map((r) => [r.id, r]));
  return stamps.map((s) => fetchedById.get(s.id) ?? localById.get(s.id)?.row).filter(Boolean);
}

/** Mất mạng hoặc lỗi: dùng điểm đã lưu trên máy, chưa có gì thì mới dùng dữ liệu mẫu. */
async function offlineOrSample(error) {
  const saved = await readAll();
  if (saved.length) {
    return { pois: sortByTour(saved.map((r) => shapePoiRow(r.row))), source: 'offline', error: error ?? null };
  }
  return sampleResult(error);
}

/**
 * Tải điểm từ Supabase (RLS tự quyết định thấy gì: khách thấy bản đã duyệt, admin thấy tất cả).
 * Có mạng thì đồng bộ và lưu vào máy; lỗi mạng thì dùng bản đã lưu; chưa có gì thì dùng dữ liệu mẫu.
 */
export async function loadPois() {
  if (!supabase) return offlineOrSample('Chưa cấu hình Supabase');
  try {
    const rows = await syncFromServer();
    if (!rows.length) return sampleResult('CSDL chưa có điểm nào');
    return { pois: sortByTour(rows.map(shapePoiRow)), source: 'supabase', error: null };
  } catch (e) {
    return offlineOrSample(e.message);
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

/**
 * Toàn bộ ô vị trí của view v_heat để vẽ bản đồ nhiệt (Supabase trả tối đa 1000 dòng mỗi lần nên đọc từng trang).
 * Sắp theo số lượt giảm dần; chỉ lấy tối đa maxRows ô nhiều nhất.
 */
export async function fetchHeat(maxRows = 5000) {
  const rows = [];
  for (let from = 0; from < maxRows; from += 1000) {
    const { data, error } = await supabase
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
  return rows;
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

// ---------- Tải ảnh / audio lên Storage (quản trị) ----------
const MEDIA_BUCKET = 'poi-media';

/**
 * Tải một file lên bucket poi-media rồi trả về đường dẫn công khai.
 * Tên file có mốc thời gian nên không bao giờ trùng, không cần quyền ghi đè.
 * Quyền tải lên do policy của Storage kiểm tra (chỉ admin).
 */
export async function uploadMedia(file, folder) {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '31536000' });
  check(error);
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ---------- AI soạn nháp và dịch (quản trị) ----------
/**
 * Gọi hàm máy chủ /api/ai (khóa Gemini nằm trên Vercel). Gửi kèm token đăng nhập để máy chủ kiểm tra là admin.
 * payload: { action: 'draft', name, notes } hoặc { action: 'translate', name, text, targets }.
 */
export async function callAi(payload) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Hãy đăng nhập lại bằng tài khoản quản trị.');
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Lỗi ${res.status}`);
  return json.result;
}
