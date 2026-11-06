import { useEffect, useState } from 'react';
import { Link } from '../router.jsx';
import { hasSupabase } from '../supabase.js';
import { useAdminAuth } from '../hooks/useAdminAuth.js';
import { useGeolocation } from '../hooks/useGeolocation.js';
import { usePoiData } from '../hooks/usePoiData.js';
import { usePois } from '../hooks/usePois.js';
import { savePoi } from '../data/repo.js';
import Readout from '../components/Readout.jsx';
import Measure from './Measure.jsx';
import Geofence from './Geofence.jsx';
import Voices from './Voices.jsx';
import PoiEditor from './PoiEditor.jsx';
import Stats from './Stats.jsx';

const round6 = (n) => Math.round(n * 1e6) / 1e6;

function Login({ onSignIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const m = await onSignIn(email.trim(), password);
    if (m) setErr(m);
    setBusy(false);
  }
  return (
    <form className="page login" onSubmit={submit}>
      <h2>Đăng nhập quản trị</h2>
      <label className="field"><span>Email</span><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label className="field"><span>Mật khẩu</span><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      <button className="btn primary block" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      {err && <p className="note warn" role="alert">{err}</p>}
    </form>
  );
}

export default function Admin({ navigate }) {
  const auth = useAdminAuth();
  const db = usePoiData();
  const local = usePois();
  const [tab, setTab] = useState(hasSupabase ? 'poi' : 'measure');
  const [gpsOn, setGpsOn] = useState(false);
  const gps = useGeolocation(gpsOn);
  const uid = auth.session?.user?.id;

  useEffect(() => { if (uid) db.reload(); }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const dbStore = {
    pois: db.pois,
    async save(id, fix) {
      await savePoi(id, { lat: round6(fix.lat), lng: round6(fix.lng) });
      await db.reload();
    },
    exportJson: () => JSON.stringify(db.pois.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng })), null, 2),
  };
  const store = hasSupabase ? dbStore : local;

  const tabs = hasSupabase
    ? [['poi', 'Điểm'], ['measure', 'Đo tọa độ'], ['geofence', 'Thử vùng'], ['voices', 'Giọng đọc'], ['stats', 'Thống kê']]
    : [['measure', 'Đo tọa độ'], ['geofence', 'Thử vùng'], ['voices', 'Giọng đọc']];

  const head = (
    <header className="top">
      <h1>Quản trị: Thuyết minh Đại học Sài Gòn</h1>
      <p>
        <Link to="/tour" navigate={navigate}>Xem trang khách</Link>
        {auth.session && <> · {auth.session.user.email} · <button className="linkbtn" onClick={auth.signOut}>Đăng xuất</button></>}
      </p>
    </header>
  );

  if (hasSupabase && auth.loading) return <div className="app">{head}<p className="note">Đang kiểm tra đăng nhập…</p></div>;
  if (hasSupabase && !auth.session) return <div className="app">{head}<Login onSignIn={auth.signIn} /></div>;
  if (hasSupabase && !auth.isAdmin) {
    return (
      <div className="app">{head}
        <div className="page">
          <p className="note warn">Tài khoản này chưa được cấp quyền quản trị. Nhờ quản trị viên thêm bạn vào danh sách admin.</p>
        </div>
      </div>
    );
  }

  const needGps = tab === 'measure' || tab === 'geofence';
  return (
    <div className="app admin">
      {head}
      <nav className="tabs" style={{ '--n': tabs.length }} aria-label="Chức năng quản trị">
        {tabs.map(([id, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>
      {!hasSupabase && <p className="note warn">Chưa cấu hình Supabase: các công cụ dưới đây chạy ở chế độ cục bộ (lưu trên máy này).</p>}
      {hasSupabase && db.source !== 'supabase' && !db.loading && <p className="note warn">Đang dùng dữ liệu mẫu ({db.error}). Chưa lưu được vào CSDL.</p>}
      {needGps && <Readout gps={gps} on={gpsOn} onStart={() => setGpsOn(true)} />}
      <main>
        {tab === 'poi' && <PoiEditor pois={db.pois} reload={db.reload} writable={db.source === 'supabase'} />}
        {tab === 'measure' && <Measure gps={gps} store={store} />}
        {tab === 'geofence' && <Geofence gps={gps} store={store} />}
        {tab === 'voices' && <Voices />}
        {tab === 'stats' && <Stats pois={db.pois} />}
      </main>
    </div>
  );
}
