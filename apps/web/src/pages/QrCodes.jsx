import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { poiName } from '@tm/core';

function QrItem({ title, url, file }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: 'M' })
      .then((d) => { if (alive) setSrc(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [url]);
  return (
    <figure className="qr-item">
      {src ? <img src={src} alt={`Mã QR: ${title}`} width="200" height="200" /> : <div className="qr-ph" />}
      <figcaption>
        <strong>{title}</strong>
        <span className="qr-url">{url}</span>
      </figcaption>
      {src && <a className="btn small no-print" href={src} download={`qr-${file}.png`}>Tải PNG</a>}
    </figure>
  );
}

/** Mã QR cho từng điểm: quét là mở /tour?poi=<mã điểm> và nghe ngay, không cần GPS. */
export default function QrCodes({ pois }) {
  const [base, setBase] = useState(() => window.location.origin);
  const clean = base.trim().replace(/\/+$/, '');
  let host = '';
  try { host = new URL(clean).hostname; } catch { /* bỏ qua */ }
  const risky = host.endsWith('.vercel.app') && host.split('.')[0].split('-').length >= 3;

  const items = [
    { title: 'Cả tuyến tham quan', url: `${clean}/tour`, file: 'tuyen' },
    ...pois.map((p) => ({ title: `${p.tour_order}. ${poiName(p)}`, url: `${clean}/tour?poi=${encodeURIComponent(p.id)}`, file: p.id })),
  ];

  return (
    <div className="page">
      <h2 className="no-print">Mã QR</h2>
      <p className="lead no-print">Mỗi mã dẫn tới đúng điểm: quét là nghe ngay, không cần bật GPS. Dán tại cổng và từng khu, nhất là chỗ GPS yếu.</p>
      <label className="field no-print">
        <span>Địa chỉ trang web (có trong mã QR)</span>
        <input value={base} onChange={(e) => setBase(e.target.value)} />
      </label>
      {risky && (
        <p className="note warn no-print">Địa chỉ này có vẻ là một bản deploy riêng và có thể đổi. Trước khi in, hãy dùng địa chỉ chính (ví dụ web-synguyen.vercel.app) hoặc tên miền riêng, nếu không mã đã dán sẽ hỏng.</p>
      )}
      <button className="btn no-print" onClick={() => window.print()}>In tất cả</button>
      <div className="qr-grid">
        {items.map((it) => <QrItem key={it.file} {...it} />)}
      </div>
    </div>
  );
}
