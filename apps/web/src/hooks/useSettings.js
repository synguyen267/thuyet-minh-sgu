import { useCallback, useState } from 'react';

const KEY = 'tm.settings.v1';
const DEFAULTS = { lang: 'vi', cooldownMin: 10, scale: 1 };

function read() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return DEFAULTS; }
}

/** Cài đặt của người nghe, lưu trên máy: ngôn ngữ, thời gian không đọc lặp, độ nhạy vùng. */
export function useSettings() {
  const [settings, setSettings] = useState(read);
  const update = useCallback((patch) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* bỏ qua */ }
      return next;
    });
  }, []);
  return [settings, update];
}
