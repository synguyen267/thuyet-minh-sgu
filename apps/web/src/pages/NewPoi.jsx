import { useState } from 'react';
import { slugify } from '@tm/core';
import { createPoi } from '../data/repo.js';

/** Thêm điểm mới. Điểm mới luôn ẨN cho tới khi có tọa độ và lời thuyết minh đã duyệt. */
export default function NewPoi({ pois, reload, onCreated }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeEdited, setCodeEdited] = useState(false);
  const [radius, setRadius] = useState('20');
  const [priority, setPriority] = useState('2');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const nextOrder = Math.max(0, ...pois.map((p) => p.tour_order ?? 0)) + 1;

  function changeName(v) {
    setName(v);
    if (!codeEdited) setCode(slugify(v));
  }

  async function create() {
    setBusy(true); setMsg('');
    try {
      const n = name.trim();
      if (!n) throw new Error('Nhập tên điểm.');
      if (!/^[a-z0-9-]{1,60}$/.test(code)) throw new Error('Mã điểm chỉ gồm chữ thường không dấu, số và dấu gạch ngang.');
      if (pois.some((p) => p.id === code)) throw new Error(`Mã "${code}" đã có. Hãy đổi mã.`);
      const r = Number(radius), pr = Number(priority);
      if (!(Number.isInteger(r) && r >= 5 && r <= 200)) throw new Error('Bán kính phải là số nguyên từ 5 đến 200 mét.');
      if (!(Number.isInteger(pr) && pr >= 0 && pr <= 10)) throw new Error('Ưu tiên phải là số nguyên từ 0 đến 10.');
      await createPoi({ id: code, name_vi: n, tour_order: nextOrder, radius_m: r, priority: pr });
      await reload();
      onCreated?.(code);
      setMsg(`Đã tạo điểm "${n}" (đang ẨN với khách). Việc tiếp theo: đo tọa độ ở tab Đo tọa độ, viết lời thuyết minh và chọn Đã duyệt bên dưới, rồi tick "Hiện cho khách" và Lưu.`);
      setName(''); setCode(''); setCodeEdited(false); setOpen(false);
    } catch (e) {
      setMsg(`Lỗi: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="newpoi">
      {!open ? (
        <button className="btn" onClick={() => { setOpen(true); setMsg(''); }}>Thêm điểm mới</button>
      ) : (
        <div className="newpoi-form">
          <h3>Thêm điểm mới</h3>
          <label className="field"><span>Tên điểm (tiếng Việt)</span><input value={name} onChange={(e) => changeName(e.target.value)} placeholder="Ví dụ: Hội trường A" /></label>
          <label className="field">
            <span>Mã điểm (nằm trong mã QR, không đổi được sau khi tạo)</span>
            <input value={code} onChange={(e) => { setCode(e.target.value.toLowerCase()); setCodeEdited(true); }} />
          </label>
          <div className="grid2">
            <label className="field"><span>Bán kính (m)</span><input inputMode="numeric" value={radius} onChange={(e) => setRadius(e.target.value)} /></label>
            <label className="field"><span>Ưu tiên (0 đến 10)</span><input inputMode="numeric" value={priority} onChange={(e) => setPriority(e.target.value)} /></label>
          </div>
          <p className="note">Điểm nhỏ nằm cạnh khu lớn (như hội trường, thư viện) nên có ưu tiên cao hơn khu lớn và bán kính nhỏ, để đứng trước nó thì nghe đúng nó.</p>
          <div className="row">
            <button className="btn primary" onClick={create} disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo điểm'}</button>
            <button className="btn" onClick={() => setOpen(false)} disabled={busy}>Hủy</button>
          </div>
        </div>
      )}
      {msg && <p className={`note ${msg.startsWith('Lỗi') ? 'warn' : 'ok'}`} role="status">{msg}</p>}
    </div>
  );
}
