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

// ---------- Quản trị: đi qua backend /api (controller, service, repository) ----------
// Backend kiểm tra quyền admin và dữ liệu, rồi mới ghi vào Supabase bằng chính token của người dùng.
function check(error) {
  if (error) throw new Error(error.message); // dùng cho Storage
}

/** Gọi backend kèm token đăng nhập. Trả về phần result của câu trả lời, lỗi thì ném Error với câu tiếng Việt từ backend. */
async function api(path, { method = 'GET', body } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Hãy đăng nhập lại bằng tài khoản quản trị.');
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại.');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || (res.status === 504 ? 'Máy chủ phản hồi quá lâu. Hãy bấm thử lại.' : `Lỗi ${res.status}`));
  }
  return json.result;
}

const poiPath = (id) => `/pois/${encodeURIComponent(id)}`;

export async function savePoi(id, fields) {
  await api(poiPath(id), { method: 'PATCH', body: fields });
}

export async function saveTranslation(poi_id, lang, fields) {
  const { name, tts_script, audio_url, status } = fields;
  await api(`${poiPath(poi_id)}/translations/${encodeURIComponent(lang)}`, { method: 'PUT', body: { name, tts_script, audio_url, status } });
}

export async function fetchStats() {
  return api('/stats');
}

/** Các ô vị trí của view v_heat để vẽ bản đồ nhiệt (backend đọc từng trang, tối đa maxRows ô nhiều nhất). */
export async function fetchHeat(maxRows = 5000) {
  return api(`/stats/heat?max=${encodeURIComponent(maxRows)}`);
}

// ---------- Thêm / xóa điểm (quản trị) ----------
/** Tạo điểm mới ở trạng thái ẨN (khách chưa thấy) kèm tên tiếng Việt dạng bản nháp. */
export async function createPoi({ id, name_vi, tour_order, radius_m, priority }) {
  await api('/pois', { method: 'POST', body: { id, name_vi, tour_order, radius_m, priority } });
}

export async function countPlays(id) {
  return (await api(`${poiPath(id)}/plays`)).plays;
}

/** Backend chỉ cho xóa điểm chưa có lượt nghe (BR-15); điểm đã có lượt nghe thì trả lỗi 409. */
export async function deletePoi(id) {
  await api(poiPath(id), { method: 'DELETE' });
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
 * Gọi dịch vụ AI của backend. payload: { action: 'draft', name, notes } hoặc { action: 'translate', name, text, targets }.
 * Khóa Gemini chỉ nằm trên máy chủ.
 */
export async function callAi(payload) {
  const { action, ...body } = payload ?? {};
  if (!['draft', 'translate'].includes(action)) throw new Error('Yêu cầu AI không hợp lệ.');
  return api(`/ai/${action}`, { method: 'POST', body });
}
