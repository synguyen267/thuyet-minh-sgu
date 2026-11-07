import { useEffect } from 'react';

/** Giữ màn hình sáng khi đang tham quan (khóa màn hình thì điện thoại dừng định vị và giọng đọc). */
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return undefined;
    let lock = null;
    let cancelled = false;
    const acquire = async () => {
      try { lock = await navigator.wakeLock.request('screen'); } catch { /* không hỗ trợ hoặc bị từ chối */ }
    };
    acquire();
    const onVisible = () => { if (document.visibilityState === 'visible' && !cancelled) acquire(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release?.().catch(() => {});
    };
  }, [active]);
}
