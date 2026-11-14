/* Service Worker: giữ giao diện trang để mở lại được khi mất mạng.
 * Ảnh và audio trong gói offline được phục vụ từ kho tm-media; dữ liệu điểm và ô bản đồ thì không bị chặn ở đây. */
const CACHE = 'tm-shell-v2';
const MEDIA = 'tm-media-v1'; // gói offline (ảnh, audio), do trang tải về
const MEDIA_PATH = '/storage/v1/object/public/poi-media/';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== MEDIA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Phục vụ ảnh/audio từ gói offline. Safari đòi trả lời 206 khi phát audio nên phải tự cắt theo Range. */
async function mediaResponse(req) {
  const cache = await caches.open(MEDIA);
  const hit = await cache.match(req.url, { ignoreVary: true });
  if (!hit) return fetch(req); // chưa tải gói: đi mạng như bình thường
  const range = req.headers.get('range');
  if (!range) return hit;
  const blob = await hit.blob();
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  const start = m && m[1] ? parseInt(m[1], 10) : 0;
  const end = m && m[2] ? Math.min(parseInt(m[2], 10), blob.size - 1) : blob.size - 1;
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': hit.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${blob.size}`,
      'Content-Length': String(end - start + 1),
    },
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.includes(MEDIA_PATH)) {
    event.respondWith(mediaResponse(req));
    return;
  }
  if (url.origin !== self.location.origin) return; // Supabase, bản đồ, phông chữ: để trình duyệt tự xử lý

  // Mở trang: ưu tiên mạng (luôn lấy bản mới), mất mạng thì dùng trang đã lưu
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // File build (tên có mã băm nên không bao giờ đổi nội dung): lấy từ bộ nhớ, chưa có thì tải rồi lưu
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // File tĩnh khác (biểu tượng, manifest): dùng bản đã lưu ngay, đồng thời cập nhật ngầm
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
