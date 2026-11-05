import { useState } from 'react';
import { useGeolocation } from './hooks/useGeolocation.js';
import { usePois } from './hooks/usePois.js';
import Readout from './components/Readout.jsx';
import Measure from './pages/Measure.jsx';
import Geofence from './pages/Geofence.jsx';
import Voices from './pages/Voices.jsx';

const TABS = [
  { id: 'measure', label: 'Đo tọa độ' },
  { id: 'geofence', label: 'Thử vùng' },
  { id: 'voices', label: 'Giọng đọc' },
];

export default function App() {
  const [tab, setTab] = useState('measure');
  const [gpsOn, setGpsOn] = useState(false);
  const gps = useGeolocation(gpsOn);
  const store = usePois();

  return (
    <div className="app">
      <header className="top">
        <h1>Thuyết minh Đại học Sài Gòn</h1>
        <p>Bản thử nghiệm (PoC): GPS, vùng thuyết minh, giọng đọc</p>
      </header>
      <Readout gps={gps} on={gpsOn} onStart={() => setGpsOn(true)} />
      <main>
        {tab === 'measure' && <Measure gps={gps} store={store} />}
        {tab === 'geofence' && <Geofence gps={gps} store={store} />}
        {tab === 'voices' && <Voices />}
      </main>
      <nav className="tabs" aria-label="Chức năng">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
