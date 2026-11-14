// Lưu điểm vào IndexedDB của trình duyệt để mất mạng vẫn dùng được dữ liệu thật.
// Mỗi bản ghi: { id, sig, row } với row là dòng poi thô từ Supabase (kèm poi_translation).
// Mọi hàm đều nuốt lỗi: IndexedDB không dùng được (chế độ riêng tư...) thì app vẫn chạy như cũ.
const DB_NAME = 'tm-offline';
const STORE = 'poi';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Đọc toàn bộ điểm đã lưu. Lỗi thì trả về mảng rỗng. */
export async function readAll() {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

function write(fn) {
  return openDb().then(
    (db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    })
  );
}

/** Thêm hoặc cập nhật nhiều điểm (cùng id thì ghi đè). */
export async function putMany(records) {
  try {
    await write((store) => records.forEach((r) => store.put(r)));
  } catch { /* bỏ qua */ }
}

/** Xóa các điểm theo id (điểm đã bị ẩn hoặc xóa trên server). */
export async function removeMany(ids) {
  try {
    await write((store) => ids.forEach((id) => store.delete(id)));
  } catch { /* bỏ qua */ }
}
