import { useEffect, useState } from 'react';
import { LANG_CODES, poiName } from '@tm/core';
import { LANGS } from '../speech.js';
import { savePoi, saveTranslation, countPlays, deletePoi, uploadMedia, callAi } from '../data/repo.js';
import NewPoi from './NewPoi.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const num = (v) => (v === '' || v == null ? null : Number(v));
const MAX_MEDIA_MB = 10;

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
  const [aiBusy, setAiBusy] = useState(false);
  const [notes, setNotes] = useState('');
  const [confirmBox, setConfirmBox] = useState(null); // hộp xác nhận đang mở (hoặc null)

  const poi = pois.find((p) => p.id === sel);
  useEffect(() => { if (poi) setForm(toForm(poi)); }, [sel, pois]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!poi || !form) return <div className="page"><p className="empty">Chưa có điểm nào.</p></div>;

  /** Mở hộp xác nhận trong trang. Bấm đồng ý thì đóng hộp rồi chạy onConfirm. */
  function ask(opts) { setConfirmBox(opts); }

  async function removePoi() {
    setBusy(true); setMsg('');
    try {
      const n = await countPlays(sel);
      if (n > 0) throw new Error(`điểm này đã có ${n} lượt nghe. Hãy bỏ tick "Hiện cho khách" để ẩn thay vì xóa, để giữ số liệu.`);
      ask({
        title: 'Xóa hẳn điểm này?',
        message: `Điểm "${poiName(poi)}" sẽ bị xóa vĩnh viễn, không hoàn tác được và mã QR của điểm sẽ hỏng.`,
        confirmLabel: 'Xóa điểm',
        danger: true,
        onConfirm: doRemove,
      });
    } catch (e) {
      setMsg(`Lỗi: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function doRemove() {
    setBusy(true); setMsg('');
    try {
      await deletePoi(sel);
      const other = pois.find((x) => x.id !== sel);
      await reload();
      setSel(other?.id ?? '');
      setMsg('Đã xóa điểm.');
    } catch (e) {
      setMsg(`Lỗi: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setTr = (patch) => setForm((f) => ({ ...f, tr: { ...f.tr, [lang]: { ...f.tr[lang], ...patch } } }));
  const t = form.tr[lang];
  const setZone = (i, patch) => setForm((f) => ({ ...f, zones: f.zones.map((z, k) => (k === i ? { ...z, ...patch } : z)) }));
  const addZone = () => setForm((f) => ({ ...f, zones: [...f.zones, { lat: '', lng: '', radius_m: String(f.radius_m || 20) }] }));
  const removeZone = (i) => setForm((f) => ({ ...f, zones: f.zones.filter((_, k) => k !== i) }));

  /** Chọn file ảnh hoặc audio, tải lên Storage, rồi điền đường dẫn vào ô tương ứng. */
  async function upload(e, kind) {
    const file = e.target.files?.[0];
    e.target.value = ''; // cho phép chọn lại đúng file đó lần sau
    if (!file) return;
    setMsg('');
    if (!file.type.startsWith(kind === 'image' ? 'image/' : 'audio/')) {
      setMsg(`Lỗi: file không phải ${kind === 'image' ? 'ảnh' : 'audio'}.`);
      return;
    }
    if (file.size > MAX_MEDIA_MB * 1024 * 1024) {
      setMsg(`Lỗi: file quá lớn (tối đa ${MAX_MEDIA_MB} MB).`);
      return;
    }
    setBusy(true);
    try {
      const folder = kind === 'image' ? `${sel}/image` : `${sel}/audio-${lang}`;
      const url = await uploadMedia(file, folder);
      if (kind === 'image') set({ image_url: url });
      else setTr({ audio_url: url });
      setMsg('Đã tải lên. Nhớ bấm "Lưu điểm này" để lưu đường dẫn.');
    } catch (err) {
      setMsg(`Lỗi: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  /** AI soạn nháp tiếng Việt từ tên điểm và ý chính. Kết quả luôn là bản nháp, chưa lưu. */
  function aiDraft() {
    const vi = form.tr.vi;
    if (!vi.name.trim()) { setMsg('Lỗi: nhập tên tiếng Việt của điểm trước khi nhờ AI soạn.'); return; }
    if (vi.tts_script.trim()) {
      ask({
        title: 'Ghi đè lời thuyết minh tiếng Việt?',
        message: 'Ô lời thuyết minh tiếng Việt đang có nội dung. Bản AI soạn sẽ thay thế nội dung đó. Chưa có gì được lưu cho tới khi bạn bấm "Lưu điểm này".',
        confirmLabel: 'Ghi đè bằng bản AI',
        onConfirm: runDraft,
      });
      return;
    }
    runDraft();
  }

  async function runDraft() {
    const vi = form.tr.vi;
    setAiBusy(true); setMsg('');
    try {
      const r = await callAi({ action: 'draft', name: vi.name.trim(), notes: notes.trim() });
      setForm((f) => ({ ...f, tr: { ...f.tr, vi: { ...f.tr.vi, tts_script: r.text, status: 'draft' } } }));
      setMsg('AI đã soạn xong bản nháp tiếng Việt. Hãy đọc lại, sửa nếu cần, rồi bấm "Lưu điểm này".');
    } catch (e) {
      setMsg(`Lỗi: ${e.message}`);
    } finally {
      setAiBusy(false);
    }
  }

  /** AI dịch từ tiếng Việt sang các ngôn ngữ còn lại. Kết quả luôn là bản nháp, chưa lưu. */
  function aiTranslate() {
    const vi = form.tr.vi;
    if (!vi.name.trim() || !vi.tts_script.trim()) { setMsg('Lỗi: cần có tên và lời thuyết minh tiếng Việt trước khi nhờ AI dịch.'); return; }
    const filled = LANGS.filter((l) => l.code !== 'vi' && form.tr[l.code].tts_script.trim()).map((l) => l.label);
    if (filled.length > 0) {
      ask({
        title: 'Ghi đè các bản dịch đang có?',
        message: `${filled.join(', ')} đã có nội dung. Bản AI dịch sẽ thay thế và đưa các ngôn ngữ này về "Bản nháp", nên khách sẽ không nghe được cho tới khi bạn duyệt lại. Chưa có gì được lưu cho tới khi bạn bấm "Lưu điểm này".`,
        confirmLabel: 'Ghi đè bằng bản AI',
        onConfirm: runTranslate,
      });
      return;
    }
    runTranslate();
  }

  async function runTranslate() {
    const vi = form.tr.vi;
    const targets = LANG_CODES.filter((l) => l !== 'vi');
    setAiBusy(true); setMsg('');
    try {
      const r = await callAi({ action: 'translate', name: vi.name.trim(), text: vi.tts_script.trim(), targets });
      setForm((f) => {
        const tr = { ...f.tr };
        for (const l of targets) {
          if (r[l]?.name && r[l]?.text) tr[l] = { ...tr[l], name: r[l].name, tts_script: r[l].text, status: 'draft' };
        }
        return { ...f, tr };
      });
      setMsg('AI đã dịch xong sang các ngôn ngữ còn lại (đều là bản nháp). Xem lại từng ngôn ngữ, rồi bấm "Lưu điểm này".');
    } catch (e) {
      setMsg(`Lỗi: ${e.message}`);
    } finally {
      setAiBusy(false);
    }
  }

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
      <NewPoi pois={pois} reload={reload} onCreated={(id) => { setSel(id); setMsg(''); }} />
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
      <label className="field">
        <span>Hoặc tải ảnh lên (JPG, PNG, WebP, tối đa {MAX_MEDIA_MB} MB)</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => upload(e, 'image')} disabled={busy || !writable} />
      </label>
      {form.image_url && <img className="detail-img" src={form.image_url} alt="Xem trước ảnh điểm" />}
      <label className="field"><span>Liên kết bản đồ (tùy chọn)</span><input value={form.map_url} onChange={(e) => set({ map_url: e.target.value })} /></label>

      <h3>Nội dung thuyết minh</h3>
      <div className="chips" role="tablist" aria-label="Ngôn ngữ">
        {LANGS.map((l) => (
          <button key={l.code} role="tab" aria-selected={lang === l.code} className={`chip${lang === l.code ? ' on' : ''}`} onClick={() => setLang(l.code)}>
            {l.label}{form.tr[l.code].name ? (form.tr[l.code].status === 'approved' ? ' ✓' : ' …') : ''}
          </button>
        ))}
      </div>
      <div className="field">
        <span>Trợ lý AI (chỉ soạn bản nháp)</span>
        {lang === 'vi' && (
          <>
            <textarea rows={3} value={notes} placeholder="Ý chính để AI soạn, ví dụ: khu giảng đường chính, có thư viện ở tầng trệt (không bắt buộc)" onChange={(e) => setNotes(e.target.value)} />
            <button type="button" className="btn small" onClick={aiDraft} disabled={busy || aiBusy || !writable}>
              {aiBusy ? 'AI đang làm…' : 'AI soạn nháp tiếng Việt'}
            </button>
          </>
        )}
        <button type="button" className="btn small" onClick={aiTranslate} disabled={busy || aiBusy || !writable}>
          {aiBusy ? 'AI đang làm…' : 'AI dịch từ tiếng Việt sang các ngôn ngữ còn lại'}
        </button>
        <p className="note">AI chỉ tạo bản nháp. Bạn đọc lại và sửa, rồi đổi Trạng thái sang "Đã duyệt" thì khách mới nghe được.</p>
      </div>
      <label className="field"><span>Tên điểm</span><input value={t.name} onChange={(e) => setTr({ name: e.target.value })} /></label>
      <label className="field"><span>Lời thuyết minh (đọc bằng giọng máy)</span><textarea rows={6} value={t.tts_script} onChange={(e) => setTr({ tts_script: e.target.value })} /></label>
      <label className="field"><span>Đường dẫn file audio (tùy chọn, ưu tiên hơn giọng máy)</span><input value={t.audio_url} onChange={(e) => setTr({ audio_url: e.target.value })} /></label>
      <label className="field">
        <span>Hoặc tải audio lên cho ngôn ngữ này (MP3, M4A, WAV, tối đa {MAX_MEDIA_MB} MB)</span>
        <input type="file" accept="audio/mpeg,audio/mp4,audio/wav" onChange={(e) => upload(e, 'audio')} disabled={busy || !writable} />
      </label>
      {t.audio_url && <audio controls src={t.audio_url} style={{ width: '100%', margin: '8px 0' }} />}
      <label className="field">
        <span>Trạng thái</span>
        <select value={t.status} onChange={(e) => setTr({ status: e.target.value })}>
          <option value="draft">Bản nháp (khách chưa thấy)</option>
          <option value="approved">Đã duyệt (khách nghe được)</option>
        </select>
      </label>

      <button className="btn primary block" onClick={save} disabled={busy || aiBusy || !writable}>{busy ? 'Đang xử lý…' : 'Lưu điểm này'}</button>
      {!writable && <p className="note warn">Đang dùng dữ liệu mẫu nên chưa lưu được vào CSDL.</p>}
      {msg && <p className={`note ${msg.startsWith('Lỗi') ? 'warn' : 'ok'}`} role="status">{msg}</p>}
      <h3>Xóa điểm</h3>
      <p className="note">Ẩn điểm (bỏ tick "Hiện cho khách") thì khách không thấy nhưng dữ liệu còn nguyên. Chỉ xóa hẳn được điểm chưa có lượt nghe nào.</p>
      <button className="btn danger" onClick={removePoi} disabled={busy || !writable}>Xóa điểm này</button>
      {confirmBox && (
        <ConfirmDialog
          title={confirmBox.title}
          message={confirmBox.message}
          confirmLabel={confirmBox.confirmLabel}
          danger={confirmBox.danger}
          onCancel={() => setConfirmBox(null)}
          onConfirm={() => { const run = confirmBox.onConfirm; setConfirmBox(null); run(); }}
        />
      )}
    </div>
  );
}
