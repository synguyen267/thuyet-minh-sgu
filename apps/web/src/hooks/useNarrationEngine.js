import { useEffect, useMemo, useRef, useState } from 'react';
import { NarrationController, pickNarration } from '@tm/core';
import { playNarration, stopNarration } from '../narrator.js';
import { getVoices, speechSupported, voicesFor } from '../speech.js';
import { logPlay } from '../data/repo.js';

/**
 * Nối NarrationController (logic thuần) với việc phát âm thanh và ghi nhật ký.
 * request(id, source): source là 'gps' | 'qr' | 'manual'.
 */
export function useNarrationEngine({ pois, lang, voiceURI, cooldownMin, getPos }) {
  const [current, setCurrent] = useState(null);
  const [visited, setVisited] = useState(() => new Set());
  const [queue, setQueue] = useState([]);
  const [interrupted, setInterrupted] = useState(false);

  const ctl = useRef(null);
  if (!ctl.current) ctl.current = new NarrationController({ cooldownMs: cooldownMin * 60000 });
  useEffect(() => { ctl.current.cooldownMs = cooldownMin * 60000; }, [cooldownMin]);

  const latest = useRef({});
  latest.current = { pois, lang, voiceURI, getPos };
  const playRef = useRef(null);

  const engine = useMemo(() => {
    const syncQueue = () => setQueue(ctl.current.snapshot().queue);

    function logCurrent(completed) {
      const p = playRef.current;
      if (!p) return;
      clearTimeout(p.timer);
      playRef.current = null;
      const pos = latest.current.getPos?.();
      logPlay({
        poi_id: p.id, lang: p.lang, source: p.source,
        lat: pos?.lat, lng: pos?.lng,
        duration_s: Math.round((Date.now() - p.t0) / 1000), completed,
      });
    }

    function start(id, source) {
      const { pois: list, lang: l, voiceURI: v } = latest.current;
      const poi = list.find((x) => x.id === id);
      const n = poi ? pickNarration(poi, l) : null;
      if (!n) { // điểm chưa có nội dung: bỏ qua, sang điểm kế tiếp
        setCurrent(null);
        const r = ctl.current.finish();
        syncQueue();
        if (r.action === 'play') start(r.id, r.source);
        return;
      }
      // Nhiều trình duyệt trả danh sách giọng rỗng dù vẫn đọc được: chỉ coi là thiếu giọng khi có danh sách mà không có ngôn ngữ này.
      const all = getVoices();
      const textOnly = !n.audioUrl && (!speechSupported() || (all.length > 0 && voicesFor(n.lang, all).length === 0));
      const readTime = Math.min(30000, 4000 + n.text.length * 60);
      const session = { id, lang: n.lang, source, t0: Date.now(), timer: null };
      playRef.current = session;
      setCurrent({ id, text: n.text, lang: n.lang, textOnly, source });
      setVisited((s) => new Set(s).add(id));
      const done = () => { if (playRef.current === session) finish(true); };
      const fail = () => {
        if (playRef.current !== session) return;
        // Không phát được tiếng: hiện chữ thay thế rồi tự sang điểm kế tiếp
        setCurrent((c) => (c && c.id === id ? { ...c, textOnly: true } : c));
        session.timer = setTimeout(done, readTime);
      };
      if (textOnly) {
        session.timer = setTimeout(done, readTime);
      } else {
        playNarration({ text: n.text, lang: n.lang, audioUrl: n.audioUrl, voiceURI: v, onend: done, onerror: fail });
      }
    }

    function finish(completed) {
      logCurrent(completed);
      setCurrent(null);
      const r = ctl.current.finish();
      syncQueue();
      if (r.action === 'play') start(r.id, r.source);
    }

    return {
      request(id, source = 'gps') {
        const r = ctl.current.request(id, { source });
        if (r.action === 'play') {
          if (r.preempted) { logCurrent(false); stopNarration(); }
          start(r.id, source);
        }
        syncQueue();
        return r;
      },
      /** Người dùng bấm bỏ qua điểm đang phát. */
      skip() {
        logCurrent(false);
        stopNarration();
        finish(false);
      },
      /** Trang bị ẩn, có cuộc gọi hoặc thông báo (FR-22). */
      interrupt() {
        if (!ctl.current.snapshot().current) return false;
        ctl.current.interrupt();
        logCurrent(false);
        stopNarration();
        setInterrupted(true);
        return true;
      },
      resume() {
        setInterrupted(false);
        const r = ctl.current.resume();
        if (r.action === 'play') start(r.id, r.source ?? ctl.current.current?.source ?? 'gps');
        syncQueue();
      },
      dismiss() {
        setInterrupted(false);
        setCurrent(null);
        const r = ctl.current.dismiss();
        syncQueue();
        if (r.action === 'play') start(r.id, r.source);
      },
      stopAll() {
        logCurrent(false);
        stopNarration();
        ctl.current.reset();
        setCurrent(null);
        setQueue([]);
        setInterrupted(false);
      },
      resetVisited() { setVisited(new Set()); },
    };
  }, []);

  // FR-22: chuyển ứng dụng hoặc khóa màn hình thì tạm dừng
  useEffect(() => {
    const onVisibility = () => { if (document.hidden) engine.interrupt(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [engine]);

  useEffect(() => () => { stopNarration(); }, []);

  return { current, visited, queue, interrupted, ...engine };
}
