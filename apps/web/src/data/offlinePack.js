// Gói offline (FR-13): tải trước ảnh và audio của các điểm vào bộ nhớ của trình duyệt.
// Service Worker (public/sw.js) sẽ phục vụ các file này khi không có mạng.
import { pickNarration } from '@tm/core';

const MEDIA_CACHE = 'tm-media-v1'; // phải trùng tên trong public/sw.js
const INFO_KEY = 'tm.pack.v1';
const MEDIA_PATH = '/storage/v1/object/public/poi-media/'; // chỉ tải file nằm trong kho poi-media

/** Danh sách đường dẫn ảnh và audio cần tải (audio theo ngôn ngữ đang chọn, không trùng lặp). */
export function mediaUrlsFor(pois, lang) {
  const urls = new Set();
  for (const p of pois) {
    if (p.image_url) urls.add(p.image_url);
    const n = pickNarration(p, lang);
    if (n?.audioUrl) urls.add(n.audioUrl);
  }
  return [...urls].filter((u) => u.includes(MEDIA_PATH));
}

/** Thông tin gói đã tải: { count, bytes, at } hoặc null. */
export function readPackInfo() {
  try { return JSON.parse(localStorage.getItem(INFO_KEY) || 'null'); } catch { return null; }
}

function saveInfo(info) {
  try { localStorage.setItem(INFO_KEY, JSON.stringify(info)); } catch { /* bỏ qua */ }
}

/** Đếm số file và tổng dung lượng đang có trong kho. */
async function measure(cache) {
  const keys = await cache.keys();
  let bytes = 0;
  for (const k of keys) {
    const r = await cache.match(k, { ignoreVary: true });
    if (r) bytes += (await r.blob()).size;
  }
  return { count: keys.length, bytes };
}

/**
 * Tải lần lượt từng file vào kho. File đã có thì bỏ qua (đường dẫn có mốc thời gian nên không đổi nội dung).
 * onProgress({ done, bytes }) gọi sau mỗi file; bytes là dung lượng tải thêm trong lần này.
 * Trả về { count, bytes, at, failed }.
 */
export async function downloadPack(urls, onProgress) {
  if (!('caches' in window)) throw new Error('Trình duyệt chưa hỗ trợ lưu offline.');
  try { await navigator.storage?.persist?.(); } catch { /* bỏ qua */ }

  const cache = await caches.open(MEDIA_CACHE);
  let done = 0, bytes = 0, failed = 0;

  for (const url of urls) {
    try {
      if (!(await cache.match(url, { ignoreVary: true }))) {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await cache.put(url, res.clone());
        bytes += (await res.blob()).size;
      }
    } catch {
      failed += 1;
    }
    done += 1;
    onProgress?.({ done, bytes });
  }

  const info = { ...(await measure(cache)), at: Date.now() };
  saveInfo(info);
  return { ...info, failed };
}

/** Xóa toàn bộ gói offline để giải phóng dung lượng. */
export async function clearPack() {
  try { await caches.delete(MEDIA_CACHE); } catch { /* bỏ qua */ }
  try { localStorage.removeItem(INFO_KEY); } catch { /* bỏ qua */ }
}
