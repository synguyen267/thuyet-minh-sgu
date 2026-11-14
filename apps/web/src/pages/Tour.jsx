import { useEffect, useMemo, useRef, useState } from 'react';
import { createMovementFilter, distancesTo, findCandidates, hasZones, pickNarration, poiName } from '@tm/core';
import { Link } from '../router.jsx';
import { useGeolocation } from '../hooks/useGeolocation.js';
import { usePoiData } from '../hooks/usePoiData.js';
import { useSettings } from '../hooks/useSettings.js';
import { useVoices } from '../hooks/useVoices.js';
import { useWakeLock } from '../hooks/useWakeLock.js';
import { useNarrationEngine } from '../hooks/useNarrationEngine.js';
import { LANGS, getSavedVoice, saveVoice, unlockSpeech, voicesFor } from '../speech.js';
import { logTrack } from '../data/repo.js';
import MapView from '../components/MapView.jsx';
import { clearPack, downloadPack, mediaUrlsFor, readPackInfo } from '../data/offlinePack.js';

const GPS_MESSAGES = {
  asking: 'Đang chờ bạn cho phép vị trí. Nếu trình duyệt hỏi, hãy chọn Cho phép.',
  denied: 'Trình duyệt đang chặn vị trí. Bạn vẫn nghe được bằng nút Nghe ở từng điểm hoặc quét mã QR.',
  unsupported: 'Thiết bị này không hỗ trợ định vị. Bạn vẫn nghe được bằng nút Nghe ở từng điểm.',
  error: 'Chưa lấy được vị trí. Hãy ra chỗ thoáng. Bạn vẫn nghe được bằng nút Nghe ở từng điểm.',
};

const fmtMB = (b) => `${(b / 1048576).toFixed(1)} MB`;
const fmtDist = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

/** Link mở bản đồ ngoài: ưu tiên map_url do admin nhập, không có thì tạo từ tọa độ. */
function directionsUrl(p) {
  if (p.map_url) return p.map_url;
  if (p.lat != null && p.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
  }
  return null;
}

export default function Tour({ search, navigate }) {
  const qrId = new URLSearchParams(search).get('poi');
  const { pois: allPois, source, loading } = usePoiData();
  const [settings, setSettings] = useSettings();
  const [, bump] = useState(0);
  const [running, setRunning] = useState(false);
  const [share, setShare] = useState(true);
  const [detailId, setDetailId] = useState(null);
  const [pack, setPack] = useState(readPackInfo);
  const [packBusy, setPackBusy] = useState(null);
  const [packMsg, setPackMsg] = useState('');
  const gps = useGeolocation(running);
  useWakeLock(running);
  const voices = useVoices();
  const { lang } = settings;
  // Khách chỉ thấy điểm đã có nội dung thuyết minh (đã duyệt); điểm mới đang soạn thì ẩn
  const pois = useMemo(() => allPois.filter((p) => pickNarration(p, lang)), [allPois, lang]);

  const posRef = useRef(null);
  const livePos = running ? gps.pos : null;
  posRef.current = livePos;

  const engine = useNarrationEngine({
    pois, lang, voiceURI: getSavedVoice(lang), cooldownMin: settings.cooldownMin, getPos: () => posRef.current,
  });

  const withCoords = useMemo(() => pois.filter(hasZones), [pois]);
  const candidates = useMemo(
    () => (livePos ? findCandidates(livePos, withCoords, { radiusScale: settings.scale }) : []),
    [livePos, withCoords, settings.scale]
  );
  const selId = candidates[0]?.poi.id ?? null;

  // Vào vùng điểm mới thì xin phát (bộ điều khiển lo hàng chờ và chống đọc lặp)
  const prevSel = useRef(null);
  useEffect(() => {
    if (selId === prevSel.current) return;
    prevSel.current = selId;
    if (selId && running) engine.request(selId, 'gps');
  }, [selId, running, engine]);

  // Ghi vết di chuyển ẩn danh (chỉ khi người dùng đồng ý, tối đa 10 giây một lần)
  const trackFilter = useRef(createMovementFilter(10));
  const lastTrack = useRef(0);
  useEffect(() => {
    if (!running || !share || !livePos || livePos.accuracy > 100) return;
    const now = Date.now();
    if (now - lastTrack.current < 10000 || !trackFilter.current(livePos)) return;
    lastTrack.current = now;
    logTrack(livePos);
  }, [livePos, running, share]);

  const dist = useMemo(
    () => Object.fromEntries(distancesTo(livePos, withCoords).map((d) => [d.poi.id, d.distance])),
    [livePos, withCoords]
  );
  const ordered = useMemo(
    () => (livePos ? [...pois].sort((a, b) => (dist[a.id] ?? Infinity) - (dist[b.id] ?? Infinity) || (a.tour_order ?? 99) - (b.tour_order ?? 99)) : pois),
    [pois, dist, livePos]
  );
  const nearest = ordered.find((p) => dist[p.id] != null) ?? null;
  const qrPoi = qrId ? pois.find((p) => p.id === qrId) : null;
  const detailPoi = detailId ? pois.find((p) => p.id === detailId) : null;

  function begin() {
    unlockSpeech();
    engine.stopAll();
    engine.resetVisited();
    prevSel.current = null;
    setRunning(true);
  }
  function end() {
    engine.stopAll();
    setRunning(false);
  }
  function listen(id, src) {
    unlockSpeech();
    engine.request(id, src);
  }

  async function downloadOffline() {
    setPackMsg('');
    const urls = mediaUrlsFor(pois, lang);
    if (urls.length === 0) {
      setPackMsg('Chưa có ảnh hay audio nào để tải. Thuyết minh vẫn dùng được khi không có mạng nhờ giọng đọc của máy.');
      return;
    }
    setPackBusy({ done: 0, total: urls.length, bytes: 0 });
    try {
      const r = await downloadPack(urls, (p) => setPackBusy({ ...p, total: urls.length }));
      setPack(readPackInfo());
      setPackMsg(r.failed ? `Đã tải xong nhưng ${r.failed} file bị lỗi. Hãy thử lại khi mạng tốt hơn.` : 'Đã tải xong gói offline.');
    } catch (e) {
      setPackMsg(`Lỗi: ${e.message}`);
    } finally {
      setPackBusy(null);
    }
  }
  async function removeOffline() {
    await clearPack();
    setPack(null);
    setPackMsg('Đã xóa gói offline.');
  }

  const langVoices = voicesFor(lang, voices);
  const noVoice = voices.length > 0 && langVoices.length === 0;
  const playingPoi = engine.current ? pois.find((p) => p.id === engine.current.id) : null;

  return (
    <div className="app tour">
      <header className="tour-top">
        <Link to="/" navigate={navigate} className="back">← Trang chủ</Link>
        <h1>Tham quan Đại học Sài Gòn</h1>
        <label className="lang-pick">
          <span>Ngôn ngữ nghe</span>
          <select value={lang} onChange={(e) => setSettings({ lang: e.target.value })}>
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </label>
        {noVoice && <p className="note">Thiết bị chưa có giọng đọc cho ngôn ngữ này. Trang sẽ hiện chữ thay cho giọng nói.</p>}
        {!loading && source === 'sample' && <p className="note">Đang dùng dữ liệu tạm. Một số nội dung có thể chưa cập nhật.</p>}
        {!loading && source === 'offline' && <p className="note">Đang không có mạng: dùng dữ liệu đã lưu trên máy.</p>}
      </header>

      {qrId && (
        <section className="qr-card">
          {qrPoi ? (
            <>
              <p className="qr-lead">Bạn vừa quét mã tại</p>
              <h2>{poiName(qrPoi, lang)}</h2>
              <button className="btn primary block" onClick={() => listen(qrPoi.id, 'qr')}>Nghe thuyết minh</button>
              <Link to="/tour" navigate={navigate} className="link">Xem cả tuyến tham quan</Link>
            </>
          ) : (
            !loading && (
              <>
                <h2>Không tìm thấy điểm này</h2>
                <p className="note">Mã QR có thể đã cũ. Bạn vẫn xem được cả tuyến tham quan bên dưới.</p>
                <Link to="/tour" navigate={navigate} className="link">Xem tuyến tham quan</Link>
              </>
            )
          )}
        </section>
      )}

      <div className="tour-grid">
      <div className="tour-main">
      <MapView pois={withCoords} pos={livePos} selectedId={engine.current?.id ?? selId ?? qrPoi?.id} scale={settings.scale} lang={lang} onSelect={(id) => listen(id, 'manual')} />
      {!loading && withCoords.length === 0 && <p className="note">Các điểm chưa có tọa độ nên bản đồ chưa hiện điểm. Bạn vẫn nghe được bằng nút Nghe.</p>}

      {!running ? (
        <section className="start">
          <button className="btn primary block" onClick={begin}>Bắt đầu hành trình</button>
          <label className="check">
            <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
            <span>Chia sẻ vị trí ẩn danh để cải thiện tuyến tham quan (không kèm tên hay tài khoản)</span>
          </label>
          <p className="note">Khi bắt đầu, trang dùng vị trí của bạn để tự phát thuyết minh khi bạn đi tới gần từng khu. Bạn không cần tài khoản.</p>
        </section>
      ) : (
        <section className="start">
          <button className="btn danger block" onClick={end}>Kết thúc hành trình</button>
          <p className="note">Hãy để màn hình sáng khi đi. Nếu khóa màn hình, điện thoại sẽ dừng định vị và thuyết minh.</p>
          {gps.status !== 'ok' && <p className="note">{GPS_MESSAGES[gps.status] ?? GPS_MESSAGES.asking}</p>}
          {gps.status === 'ok' && gps.pos && (
            <p className="note" aria-live="polite">
              {gps.pos.accuracy > 60
                ? `Sai số GPS đang lớn (±${Math.round(gps.pos.accuracy)} m) nên chưa tự phát được. Hãy ra chỗ thoáng hoặc đợi vài giây.`
                : selId
                  ? `Bạn đang ở trong vùng: ${poiName(pois.find((p) => p.id === selId), lang)}.`
                  : nearest
                    ? `Chưa vào vùng nào. Gần nhất: ${poiName(nearest, lang)}, cách ${fmtDist(dist[nearest.id])}. (GPS ±${Math.round(gps.pos.accuracy)} m)`
                    : `GPS ±${Math.round(gps.pos.accuracy)} m.`}
            </p>
          )}
        </section>
      )}

      {engine.interrupted && (
        <div className="banner" role="alert">
          <p>Thuyết minh đã tạm dừng.</p>
          <div className="row">
            <button className="btn primary" onClick={engine.resume}>Nghe tiếp</button>
            <button className="btn" onClick={engine.dismiss}>Bỏ qua</button>
          </div>
        </div>
      )}

      {engine.current && playingPoi && (
        <section className="now" aria-live="polite">
          <p className="now-label">Đang thuyết minh</p>
          <h2>{poiName(playingPoi, lang)}</h2>
          {engine.current.text && <p className="now-text">{engine.current.text}</p>}
          {engine.current.textOnly && <p className="note">Thiết bị chưa có giọng đọc, nên trang hiện chữ.</p>}
          <button className="btn" onClick={engine.skip}>Bỏ qua điểm này</button>
        </section>
      )}

      {detailPoi && (
        <section className="detail">
          <div className="row">
            <h2>{poiName(detailPoi, lang)}</h2>
            <button className="btn small" onClick={() => setDetailId(null)}>Đóng</button>
          </div>
          {detailPoi.image_url && (
            <img className="detail-img" src={detailPoi.image_url} alt={poiName(detailPoi, lang)} loading="lazy" />
          )}
          <div className="row">
            <button className="btn primary" onClick={() => listen(detailPoi.id, 'manual')}>Nghe lại</button>
            {directionsUrl(detailPoi) && (
              <a className="btn" href={directionsUrl(detailPoi)} target="_blank" rel="noopener noreferrer">Chỉ đường</a>
            )}
          </div>
        </section>
      )}

      </div>
      <aside className="tour-side">
      <h2 className="stops-title">Các điểm trong trường</h2>
      <p className="note">Đi theo thứ tự nào cũng được: bạn bước vào vùng của điểm nào thì điểm đó được thuyết minh.</p>
      {loading ? <p className="note">Đang tải…</p> : (
        <ol className="stops">
          {ordered.map((p) => (
            <li key={p.id} className={`stop${engine.visited.has(p.id) ? ' visited' : ''}${engine.current?.id === p.id ? ' playing' : ''}`}>
              <span className="stop-n">{p.tour_order}</span>
              <button type="button" className="stop-body stop-open" onClick={() => setDetailId(p.id)}>
                <span className="stop-name">{poiName(p, lang)}</span>
                <span className="stop-meta">
                  {engine.visited.has(p.id) ? 'Đã nghe' : dist[p.id] != null ? `Cách ${fmtDist(dist[p.id])}` : ''}
                </span>
              </button>
              <button className="btn small" onClick={() => listen(p.id, 'manual')}>Nghe</button>
            </li>
          ))}
        </ol>
      )}

      <details className="settings">
        <summary>Cài đặt</summary>
        <label className="field">
          <span>Không đọc lặp một điểm trong</span>
          <select value={settings.cooldownMin} onChange={(e) => setSettings({ cooldownMin: Number(e.target.value) })}>
            {[5, 10, 30].map((m) => <option key={m} value={m}>{m} phút</option>)}
          </select>
        </label>
        <label className="field">
          <span>Độ nhạy vùng (khi GPS hay bị lệch, chọn Rộng)</span>
          <select value={settings.scale} onChange={(e) => setSettings({ scale: Number(e.target.value) })}>
            <option value={0.5}>Hẹp</option>
            <option value={1}>Chuẩn</option>
            <option value={1.5}>Rộng</option>
            <option value={2}>Rất rộng</option>
          </select>
        </label>
        {langVoices.length > 0 && (
          <label className="field">
            <span>Giọng đọc</span>
            <select value={getSavedVoice(lang)} onChange={(e) => { saveVoice(lang, e.target.value); bump((n) => n + 1); }}>
              <option value="">Mặc định của thiết bị</option>
              {langVoices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
            </select>
          </label>
        )}
        <div className="field">
          <span>Dùng khi không có mạng</span>
          <button type="button" className="btn small" onClick={downloadOffline} disabled={!!packBusy}>
            {packBusy ? `Đang tải ${packBusy.done}/${packBusy.total} file (${fmtMB(packBusy.bytes)})…` : 'Tải gói offline'}
          </button>
          {pack && !packBusy && (
            <p className="note">
              Đã lưu {pack.count} file, {fmtMB(pack.bytes)} (lúc {new Date(pack.at).toLocaleString('vi-VN')}).{' '}
              <button type="button" className="btn small" onClick={removeOffline}>Xóa gói offline</button>
            </p>
          )}
          {packMsg && <p className={`note${packMsg.startsWith('Lỗi') ? ' warn' : ''}`} role="status">{packMsg}</p>}
          <p className="note">Tải trước ảnh và audio của các điểm (theo ngôn ngữ đang chọn) để dùng khi sóng yếu. Nên tải bằng wifi.</p>
        </div>
      </details>
      </aside>
      </div>
    </div>
  );
}
