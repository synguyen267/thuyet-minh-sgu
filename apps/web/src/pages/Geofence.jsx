import { useEffect, useMemo, useRef, useState } from 'react';
import { NarrationController, findCandidates, distancesTo, poiName } from '@tm/core';
import { speak, stopSpeaking, unlockSpeech, getSavedVoice, speechSupported } from '../speech.js';

const SCALES = [0.5, 1, 1.5, 2];
const SKIP_TEXT = { playing: 'đang phát', queued: 'đang chờ phát', cooldown: 'vừa đọc, chưa hết thời gian chờ' };

export default function Geofence({ gps, store }) {
  const { pois } = store;
  const [simId, setSimId] = useState('');
  const [scale, setScale] = useState(1);
  const [lang, setLang] = useState('vi');
  const [cooldownMin, setCooldownMin] = useState(1);
  const [running, setRunning] = useState(false);
  const [interrupted, setInterrupted] = useState(false);
  const [log, setLog] = useState([]);

  const measured = useMemo(() => pois.filter((p) => p.lat != null), [pois]);
  const byId = useMemo(() => Object.fromEntries(pois.map((p) => [p.id, p])), [pois]);
  const ctl = useMemo(() => new NarrationController({ cooldownMs: cooldownMin * 60000 }), [cooldownMin]);

  const pos = useMemo(() => {
    if (simId) {
      const p = byId[simId];
      return p && p.lat != null ? { lat: p.lat, lng: p.lng, accuracy: 5 } : null;
    }
    return gps.pos;
  }, [simId, byId, gps.pos]);

  const addLog = (m) => setLog((l) => [{ t: new Date(), m }, ...l].slice(0, 40));

  // Luôn giữ bản mới nhất để callback onend (chạy muộn) dùng đúng giá trị
  const latest = useRef({});
  latest.current = { lang, byId, ctl };

  function playPoi(id) {
    const { lang: l, byId: map, ctl: c } = latest.current;
    const poi = map[id];
    const text = poi.tts?.[l] || poi.tts?.vi;
    addLog(`Đọc: ${poiName(poi)}`);
    speak(text, {
      code: poi.tts?.[l] ? l : 'vi',
      voiceURI: getSavedVoice(l),
      onend: () => handle(c.finish()),
      onerror: (e) => addLog(`Lỗi đọc: ${e?.error ?? e?.message ?? 'không rõ'}`),
    });
  }

  function handle(r) {
    if (r.action === 'play') playPoi(r.id);
    else if (r.action === 'queued') addLog(`Xếp hàng chờ (vị trí ${r.position})`);
    else if (r.action === 'skip') addLog(`Bỏ qua: ${SKIP_TEXT[r.reason] ?? r.reason}`);
  }

  // Đánh giá vùng mỗi khi vị trí đổi: chỉ phát khi VÀO vùng một điểm mới
  const prevSel = useRef(null);
  const candidates = useMemo(() => (pos ? findCandidates(pos, pois, { radiusScale: scale }) : []), [pos, pois, scale]);
  const selId = candidates[0]?.poi.id ?? null;

  useEffect(() => {
    if (selId === prevSel.current) return;
    const was = prevSel.current;
    prevSel.current = selId;
    if (selId) {
      const c = candidates[0];
      addLog(`Vào vùng ${c.poiName(poi)} (cách ${Math.round(c.distance)} m)`);
      if (running) handle(ctl.request(selId, { source: 'gps' }));
    } else if (was) {
      addLog('Ra khỏi vùng');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId]);

  // FR-22: trang bị ẩn (chuyển app, khóa màn hình) thì tạm dừng
  useEffect(() => {
    function onVisibility() {
      if (!running) return;
      if (document.hidden) {
        if (ctl.snapshot().current) {
          ctl.interrupt();
          stopSpeaking();
          setInterrupted(true);
          addLog('Bị gián đoạn, đã tạm dừng');
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [running, ctl]);

  useEffect(() => () => stopSpeaking(), []);

  function start() {
    unlockSpeech();
    ctl.reset();
    prevSel.current = null;
    setRunning(true);
    addLog('Bắt đầu hành trình');
  }
  function stop() {
    stopSpeaking();
    ctl.reset();
    setRunning(false);
    setInterrupted(false);
    addLog('Kết thúc hành trình');
  }
  function resume() {
    setInterrupted(false);
    handle(ctl.resume());
  }
  function dismiss() {
    setInterrupted(false);
    handle(ctl.dismiss());
  }

  const list = pos ? distancesTo(pos, pois) : [];
  const inRange = new Set(candidates.map((c) => c.poi.id));

  if (measured.length === 0) {
    return (
      <div className="page">
        <h2>Thử vùng thuyết minh</h2>
        <p className="empty">Chưa có điểm nào có tọa độ. Sang tab Đo tọa độ, đo ít nhất một điểm rồi quay lại đây.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h2>Thử vùng thuyết minh</h2>
      <p className="lead">Đi bộ trong trường: khi bước vào bán kính của điểm, trang tự đọc. Ở nhà, dùng “Giả lập đứng tại” để thử logic.</p>

      <label className="field">
        <span>Giả lập đứng tại</span>
        <select value={simId} onChange={(e) => setSimId(e.target.value)}>
          <option value="">Vị trí GPS thật</option>
          {measured.map((p) => <option key={p.id} value={p.id}>{poiName(p)}</option>)}
        </select>
      </label>

      <div className="grid2">
        <label className="field">
          <span>Độ nhạy (bán kính nhân)</span>
          <select value={scale} onChange={(e) => setScale(Number(e.target.value))}>
            {SCALES.map((s) => <option key={s} value={s}>{s}x</option>)}
          </select>
        </label>
        <label className="field">
          <span>Không đọc lặp trong</span>
          <select value={cooldownMin} onChange={(e) => setCooldownMin(Number(e.target.value))} disabled={running}>
            {[1, 5, 10].map((m) => <option key={m} value={m}>{m} phút</option>)}
          </select>
        </label>
      </div>

      <label className="field">
        <span>Ngôn ngữ đọc</span>
        <select value={lang} onChange={(e) => setLang(e.target.value)}>
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>
      </label>

      {!speechSupported() && <p className="note warn">Trình duyệt này không hỗ trợ đọc văn bản (TTS).</p>}

      {running ? (
        <button className="btn danger block" onClick={stop}>Kết thúc hành trình</button>
      ) : (
        <button className="btn primary block" onClick={start} disabled={!pos}>Bắt đầu hành trình</button>
      )}
      {!pos && <p className="note">Chưa có vị trí. Bật GPS hoặc chọn “Giả lập đứng tại”.</p>}

      {interrupted && (
        <div className="banner" role="alert">
          <p>Thuyết minh đã tạm dừng vì trang bị ẩn.</p>
          <div className="row">
            <button className="btn primary" onClick={resume}>Nghe tiếp</button>
            <button className="btn" onClick={dismiss}>Bỏ qua</button>
          </div>
        </div>
      )}

      <h3>Khoảng cách tới các điểm</h3>
      {list.length === 0 ? (
        <p className="note">Chưa tính được khoảng cách.</p>
      ) : (
        <ul className="poi-list">
          {list.map(({ poi, distance }) => (
            <li key={poi.id} className={poi.id === selId ? 'sel' : ''}>
              <div className="poi-row static">
                <span className="poi-name">{poiName(poi)}</span>
                <span className="poi-meta">
                  {Math.round(distance)} m · bán kính {Math.round((poi.radius_m ?? 20) * scale)} m
                  {inRange.has(poi.id) ? ' · trong vùng' : ''}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3>Nhật ký sự kiện</h3>
      {log.length === 0 ? (
        <p className="note">Chưa có sự kiện.</p>
      ) : (
        <ol className="log">
          {log.map((e, i) => (
            <li key={i}><time>{e.t.toLocaleTimeString('vi-VN')}</time> {e.m}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
