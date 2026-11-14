import { useEffect, useId, useRef } from 'react';

const overlay = {
  position: 'fixed',
  inset: 0,
  zIndex: 1100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  background: 'rgba(0, 0, 0, 0.55)',
};

const card = {
  width: '100%',
  maxWidth: 420,
  boxSizing: 'border-box',
  padding: 20,
  borderRadius: 12,
  background: '#fff',
  color: '#1a1a1a',
  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
};

const actions = { display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 16 };

/**
 * Hộp xác nhận ngay trong trang (thay cho window.confirm của trình duyệt).
 * Mặc định con trỏ nằm ở nút Hủy để bấm nhầm Enter không làm việc nguy hiểm.
 * Bấm Escape hoặc bấm ra ngoài hộp là hủy.
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Đồng ý',
  cancelLabel = 'Hủy',
  danger = false,
  onConfirm,
  onCancel,
}) {
  const id = useId();
  const boxRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // khóa cuộn trang phía sau
    cancelRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key !== 'Tab') return;
    // Giữ phím Tab xoay vòng trong hộp, không nhảy ra trang phía sau
    const items = boxRef.current?.querySelectorAll('button');
    if (!items || items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      style={overlay}
      onKeyDown={onKeyDown}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        ref={boxRef}
        style={card}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-msg`}
      >
        <h2 id={`${id}-title`} style={{ margin: 0, fontSize: 18 }}>{title}</h2>
        <p id={`${id}-msg`} style={{ margin: '8px 0 0', fontSize: 14, color: '#444', lineHeight: 1.5 }}>{message}</p>
        <div style={actions}>
          <button type="button" className="btn" ref={cancelRef} onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
