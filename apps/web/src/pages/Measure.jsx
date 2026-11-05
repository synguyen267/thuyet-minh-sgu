import { useEffect, useRef, useState } from 'react';
import { averageFixes } from '@tm/core';

const SECONDS = 10;

export default function Measure({ gps, store }) {
  const { pois } = store;
  const [selected, setSelected] = useState(pois[0].id);
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(SECONDS);
  const [count, setCount] = useState(0);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const samples = useRef([]);

  // Mỗi lần có vị trí mới trong lúc đo thì thêm vào mẫu
  useEffect(() => {
    if (!running || !gps.pos) return;
    samples.current.push(gps.pos);
    setCount(samples.current.length);
  }, [gps.pos, running]);

  useEffect(() => {
    if (!running) return undefined;
    const t0 = Date.now();
    const iv = setInterval(() => {
      const remain = SECONDS - Math.round((Date.now() - t0) / 1000);
      setLeft(Math.max(remain, 0));
      if (remain <= 0) {
        clearInterval(iv);
        const fix = averageFixes(samples.current);
        if (fix) {
          store.save(selected, fix);
          setMsg(`Đã lưu từ ${fix.samples} mẫu, sai số khoảng ±${fix.accuracy_m} m.`);
        } else {
          setMsg('Chưa nhận được vị trí nào. Hãy thử lại ở chỗ thoáng.');
        }
        setRunning(false);
      }
    }, 250);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function start() {
    samples.current = [];
    setCount(0);
    setLeft(SECONDS);
    setMsg('');
    setRunning(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(store.exportJson());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg('Không sao chép được. Hãy chọn và sao chép thủ công trong khung bên dưới.');
    }
  }

  const current = pois.find((p) => p.id === selected);
  const ready = gps.status === 'ok' && gps.pos;
  const done = pois.filter((p) => p.measured).length;

  return (
    <div className="page">
      <h2>Đo tọa độ tại chỗ</h2>
      <p className="lead">Đứng giữa địa điểm (với khu B, khu C: giữa lối đi), chọn điểm rồi bấm đo. Giữ máy yên trong {SECONDS} giây.</p>

      <label className="field">
        <span>Điểm cần đo</span>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} disabled={running}>
          {pois.map((p) => (
            <option key={p.id} value={p.id}>
              {p.tour_order}. {p.name.vi}{p.measured ? ' (đã đo)' : ''}
            </option>
          ))}
        </select>
      </label>

      <button className="btn primary block" onClick={start} disabled={!ready || running}>
        {running ? `Đang đo… còn ${left} giây (${count} mẫu)` : `Đo vị trí cho ${current.name.vi}`}
      </button>
      {!ready && <p className="note">Bật GPS ở phía trên trước khi đo.</p>}
      {msg && <p className="note ok" role="status">{msg}</p>}

      <h3>Tiến độ: {done}/{pois.length} điểm</h3>
      <ul className="poi-list">
        {pois.map((p) => (
          <li key={p.id} className={p.id === selected ? 'sel' : ''}>
            <button className="poi-row" onClick={() => !running && setSelected(p.id)}>
              <span className="poi-name">{p.tour_order}. {p.name.vi}</span>
              {p.measured ? (
                <span className="poi-meta done">
                  {p.lat.toFixed(6)}, {p.lng.toFixed(6)} (±{p.measured.accuracy_m} m)
                </span>
              ) : (
                <span className="poi-meta">Chưa đo</span>
              )}
            </button>
            {p.measured && (
              <a className="link" href={`https://www.google.com/maps?q=${p.lat},${p.lng}`} target="_blank" rel="noreferrer">
                Xem trên bản đồ
              </a>
            )}
          </li>
        ))}
      </ul>

      <details>
        <summary>Xuất dữ liệu (JSON)</summary>
        <p className="note">Dán nội dung này vào <code>packages/core/data/pois.sample.json</code> (các trường lat, lng) để cả nhóm dùng chung.</p>
        <textarea readOnly rows={10} value={store.exportJson()} onFocus={(e) => e.target.select()} />
        <div className="row">
          <button className="btn" onClick={copy}>{copied ? 'Đã sao chép' : 'Sao chép JSON'}</button>
          <button className="btn danger" onClick={() => window.confirm('Xóa toàn bộ tọa độ đã đo trên máy này?') && store.clear()}>
            Xóa các lần đo
          </button>
        </div>
      </details>
    </div>
  );
}
