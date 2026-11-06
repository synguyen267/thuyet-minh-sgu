import { useCallback, useEffect, useState } from 'react';
import { poiName } from '@tm/core';
import { fetchStats } from '../data/repo.js';

export default function Stats({ pois }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    setErr('');
    try { setData(await fetchStats()); } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const name = (id) => poiName(pois.find((p) => p.id === id) ?? { id });
  const avg = Object.fromEntries((data?.avg ?? []).map((a) => [a.poi_id, a]));

  return (
    <div className="page">
      <h2>Thống kê</h2>
      <button className="btn" onClick={load}>Tải lại</button>
      {err && <p className="note warn">Lỗi: {err}</p>}
      {!data && !err && <p className="note">Đang tải…</p>}
      {data && (
        <>
          <div className="grid2 stats-cards">
            <div className="stat"><span>Lượt nghe</span><strong>{data.totalPlays}</strong></div>
            <div className="stat"><span>Điểm vị trí ẩn danh</span><strong>{data.totalTracks}</strong></div>
          </div>
          <h3>Điểm được nghe nhiều nhất</h3>
          {data.top.length === 0 ? <p className="note">Chưa có lượt nghe nào.</p> : (
            <ul className="poi-list">
              {data.top.map((r) => (
                <li key={r.poi_id}><div className="poi-row static">
                  <span className="poi-name">{name(r.poi_id)}</span>
                  <span className="poi-meta">{r.plays} lượt, nghe hết {r.completed_plays}{avg[r.poi_id] ? `, trung bình ${avg[r.poi_id].avg_seconds} giây` : ''}</span>
                </div></li>
              ))}
            </ul>
          )}
          <h3>Nơi khách hay đứng (10 ô nhiều nhất)</h3>
          {data.heat.length === 0 ? <p className="note">Chưa có dữ liệu vị trí.</p> : (
            <ol className="log">
              {data.heat.map((h, i) => <li key={i}>{Number(h.lat).toFixed(5)}, {Number(h.lng).toFixed(5)}: {h.hits} lần</li>)}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
