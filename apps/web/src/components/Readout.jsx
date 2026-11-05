const MESSAGES = {
  asking: 'Đang chờ bạn cho phép vị trí. Nếu trình duyệt hỏi, hãy chọn Cho phép.',
  denied: 'Trình duyệt đang chặn vị trí. Bật lại trong cài đặt của trang web rồi tải lại trang.',
  unsupported: 'Thiết bị này không hỗ trợ định vị.',
  error: 'Không lấy được vị trí. Ra chỗ thoáng, kiểm tra GPS đã bật, rồi thử lại.',
};

function quality(acc) {
  if (acc <= 15) return 'good';
  if (acc <= 40) return 'fair';
  return 'poor';
}

const QUALITY_TEXT = { good: 'Tốt', fair: 'Tạm được', poor: 'Kém, nên đứng chỗ thoáng' };

export default function Readout({ gps, on, onStart }) {
  if (!on) {
    return (
      <section className="readout">
        <p className="readout-hint">Bật GPS để đo tọa độ và thử vùng thuyết minh. Vị trí chỉ xử lý trên máy của bạn.</p>
        <button className="btn primary" onClick={onStart}>Bật GPS</button>
      </section>
    );
  }
  if (gps.status !== 'ok' || !gps.pos) {
    return (
      <section className="readout">
        <p className="readout-hint">{MESSAGES[gps.status] ?? MESSAGES.asking}</p>
      </section>
    );
  }
  const { lat, lng, accuracy, ts } = gps.pos;
  const q = quality(accuracy);
  return (
    <section className={`readout q-${q}`} aria-live="polite">
      <div className="acc">
        <span className="acc-label">Độ chính xác GPS</span>
        <span className="acc-value">±{Math.round(accuracy)}<small> m</small></span>
        <span className="acc-quality">{QUALITY_TEXT[q]}</span>
      </div>
      <dl className="coords">
        <div><dt>Vĩ độ</dt><dd>{lat.toFixed(6)}</dd></div>
        <div><dt>Kinh độ</dt><dd>{lng.toFixed(6)}</dd></div>
        <div><dt>Cập nhật</dt><dd>{new Date(ts).toLocaleTimeString('vi-VN')}</dd></div>
      </dl>
    </section>
  );
}
