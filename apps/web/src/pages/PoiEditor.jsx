import { useEffect, useState } from 'react';
import { LANG_CODES, poiName } from '@tm/core';
import { LANGS } from '../speech.js';
import { savePoi, saveTranslation } from '../data/repo.js';

const num = (v) => (v === '' || v == null ? null : Number(v));

function toForm(p) {
  return {
    lat: p.lat ?? '', lng: p.lng ?? '', radius_m: p.radius_m ?? 20, priority: p.priority ?? 1,
    tour_order: p.tour_order ?? '', is_active: p.is_active !== false,
    image_url: p.image_url ?? '', map_url: p.map_url ?? '',
    zones: (p.extra_zones ?? []).map((z) => ({ lat: String(z.lat), lng: String(z.lng), radius_m: String(z.radius_m) })),
    tr: Object.fromEntries(LANG_CODES.map((l) => [l, {
      name: p.name?.[l] ?? '', tts_script: p.tts?.[l] ?? '', audio_url: p.audio?.[l] ?? '', status: p.status?.[l] ?? 'draft',
    }])),
  };
}

/** Sửa điểm và bản dịch. Chỉ lưu được khi đăng nhập bằng tài khoản admin (CSDL tự kiểm tra). */
export default function PoiEditor({ pois, reload, writable }) {
  const [sel, setSel] = useState(pois[0]?.id ?? '');
  const [lang, setLang] = useState('vi');
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const poi = pois.find((p) => p.id === sel);
  useEffect(() => { if (poi) setForm(toForm(poi)); }, [sel, pois]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!poi || !form) return <div className="page"><p className="empty">Chưa có điểm nào.</p></div>;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setTr = (patch) => setForm((f) => ({ ...f, tr: { ...f.tr, [lang]: { ...f.tr[lang], ...patch } } }));
  const t = form.tr[lang];
  const setZone = (i, patch) => setForm((f) => ({ ...f, zones: f.zones.map((z, k) => (k === i ? { ...z, ...patch } : z)) }));
  const addZone = () => setForm((f) => ({ ...f, zones: [...f.zones, { lat: '', lng: '', radius_m: String(f.radius_m || 20) }] }));
  const removeZone = (i) => setForm((f) => ({ ...f, zones: f.zones.filter((_, k) => k !== i) }));

  async function save() {
    setBusy(true); setMsg('');
    try {
      const lat = num(form.lat), lng = num(form.lng);
      if ((lat === null) !== (lng === null)) throw new Error('Nhập đủ cả vĩ độ và kinh độ, hoặc để trống cả hai.');
      if (lat !== null && !(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) throw new Error('Tọa độ không hợp lệ.');
      const radius = Number(form.radius_m), priority = Number(form.priority);
      if (!(Number.isInteger(radius) && radius >= 5 && radius <= 200)) throw new Error('Bán kính phải là số nguyên từ 5 đến 200 mét.');
      if (!(Number.isInteger(priority) && priority >= 0 && priority <= 10)) throw new Error('Ưu tiên phải là số nguyên từ 0 đến 10.');
      const zones = form.zones.map((z, i) => {
        const la = Number(z.lat), ln = Number(z.lng), r = Number(z.radius_m);
        if (z.lat === '' || z.lng === '' || !(la >= -90 && la <= 90 && ln >= -180 && ln <= 180)) throw new Error(`Vùng phụ ${i + 1}: tọa độ không hợp lệ.`);
        if (!(r >= 5 && r <= 200)) throw new Error(`Vùng phụ ${i + 1}: bán kính phải từ 5 đến 200 mét.`);
        return { lat: la, lng: ln, radius_m: r };
      });
      if (zones.length > 12) throw new Error('Mỗi điểm có tối đa 12 vùng phụ.');
      for (const l of LANG_CODES) {
        const x = form.tr[l];
        if ((x.tts_script.trim() || x.audio_url.trim()) && !x.name.trim()) throw new Error(`Nhập tên (${l}) trước khi lưu nội dung thuyết minh.`);
      }
      await savePoi(sel, {
        lat, lng, radius_m: radius, priority, tour_order: num(form.tour_order), is_active: form.is_active,
        image_url: form.image_url.trim() || null, map_url: form.map_url.trim() || null, extra_zones: zones,
      });
      for (const l of LANG_CODES) {
        const x = form.tr[l];
        if (!x.name.trim()) continue;
        await saveTranslation(sel, l, {
          name: x.name.trim(), tts_script: x.tts_script.trim() || null, audio_url: x.audio_url.trim() || null,
          status: x.status, source: 'human',
        });
      }
      await reload();
      setMsg('Đã lưu.');
    } catch (e) {
      setMsg(`Lỗi: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <h2>Quản lý điểm</h2>
      <label className="field">
        <span>Chọn điểm</span>
        <select value={sel} onChange={(e) => { setSel(e.target.value); setMsg(''); }}>
          {pois.map((p) => <option key={p.id} value={p.id}>{p.tour_order}. {poiName(p)}{p.is_active === false ? ' (đang ẩn)' : ''}</option>)}
        </select>
      </label>

      <label className="check"><input type="checkbox" checked={form.is_active} onChange={(e) => set({ is_active: e.target.checked })} /><span>Hiện cho khách (bỏ tick để ẩn điểm)</span></label>

      <div className="grid2">
        <label className="field"><span>Vĩ độ</span><input inputMode="decimal" value={form.lat} onChange={(e) => set({ lat: e.target.value })} /></label>
        <label className="field"><span>Kinh độ</span><input inputMode="decimal" value={form.lng} onChange={(e) => set({ lng: e.target.value })} /></label>
        <label className="field"><span>Bán kính (m)</span><input inputMode="numeric" value={form.radius_m} onChange={(e) => set({ radius_m: e.target.value })} /></label>
        <label className="field"><span>Ưu tiên (0 đến 10)</span><input inputMode="numeric" value={form.priority} onChange={(e) => set({ priority: e.target.value })} /></label>
        <label className="field"><span>Thứ tự tuyến</span><input inputMode="numeric" value={form.tour_order} onChange={(e) => set({ tour_order: e.target.value })} /></label>
      </div>
      <h3>Vùng kích hoạt phụ</h3>
      <p className="note">Khu dài (như Khu A) nên có vài vùng nhỏ dọc theo khu thay vì một vòng tròn thật to. Đi vào bất kỳ vùng nào cũng được thuyết minh điểm này. Mỗi vùng có bán kính riêng.</p>
      {form.zones.map((z, i) => (
        <div className="zone-row" key={i}>
          <label className="field"><span>Vĩ độ</span><input inputMode="decimal" value={z.lat} onChange={(e) => setZone(i, { lat: e.target.value })} /></label>
          <label className="field"><span>Kinh độ</span><input inputMode="decimal" value={z.lng} onChange={(e) => setZone(i, { lng: e.target.value })} /></label>
          <label className="field"><span>Bán kính (m)</span><input inputMode="numeric" value={z.radius_m} onChange={(e) => setZone(i, { radius_m: e.target.value })} /></label>
          <button type="button" className="btn danger small" onClick={() => removeZone(i)} aria-label={`Xóa vùng phụ ${i + 1}`}>Xóa</button>
        </div>
      ))}
      <button type="button" className="btn small" onClick={addZone}>Thêm vùng phụ</button>

      <label className="field"><span>Đường dẫn ảnh (tùy chọn)</span><input value={form.image_url} onChange={(e) => set({ image_url: e.target.value })} /></label>
      <label className="field"><span>Liên kết bản đồ (tùy chọn)</span><input value={form.map_url} onChange={(e) => set({ map_url: e.target.value })} /></label>

      <h3>Nội dung thuyết minh</h3>
      <div className="chips" role="tablist" aria-label="Ngôn ngữ">
        {LANGS.map((l) => (
          <button key={l.code} role="tab" aria-selected={lang === l.code} className={`chip${lang === l.code ? ' on' : ''}`} onClick={() => setLang(l.code)}>
            {l.label}{form.tr[l.code].name ? (form.tr[l.code].status === 'approved' ? ' ✓' : ' …') : ''}
          </button>
        ))}
      </div>
      <label className="field"><span>Tên điểm</span><input value={t.name} onChange={(e) => setTr({ name: e.target.value })} /></label>
      <label className="field"><span>Lời thuyết minh (đọc bằng giọng máy)</span><textarea rows={6} value={t.tts_script} onChange={(e) => setTr({ tts_script: e.target.value })} /></label>
      <label className="field"><span>Đường dẫn file audio (tùy chọn, ưu tiên hơn giọng máy)</span><input value={t.audio_url} onChange={(e) => setTr({ audio_url: e.target.value })} /></label>
      <label className="field">
        <span>Trạng thái</span>
        <select value={t.status} onChange={(e) => setTr({ status: e.target.value })}>
          <option value="draft">Bản nháp (khách chưa thấy)</option>
          <option value="approved">Đã duyệt (khách nghe được)</option>
        </select>
      </label>

      <button className="btn primary block" onClick={save} disabled={busy || !writable}>{busy ? 'Đang lưu…' : 'Lưu điểm này'}</button>
      {!writable && <p className="note warn">Đang dùng dữ liệu mẫu nên chưa lưu được vào CSDL.</p>}
      {msg && <p className={`note ${msg.startsWith('Lỗi') ? 'warn' : 'ok'}`} role="status">{msg}</p>}
      <p className="note">Tải ảnh và audio lên kho lưu trữ, cùng AI soạn nháp, sẽ có ở bước sau. Hiện bạn dán đường dẫn vào các ô trên.</p>
    </div>
  );
}
