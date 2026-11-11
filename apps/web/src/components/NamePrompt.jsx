import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase.js'
import { MAX_NAME, MIN_NAME, getVisitorName, setVisitorName } from '../lib/visitorName.js'
import { beatNow } from '../hooks/useHeartbeat.js'

const overlay = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  background: 'rgba(0, 0, 0, 0.55)',
}

const card = {
  width: '100%',
  maxWidth: 360,
  boxSizing: 'border-box',
  padding: 20,
  borderRadius: 12,
  background: '#fff',
  color: '#1a1a1a',
  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
}

const input = {
  width: '100%',
  boxSizing: 'border-box',
  margin: '12px 0 8px',
  padding: '10px 12px',
  fontSize: 16, // 16px để iPhone không tự phóng to khi bấm vào ô nhập
  border: '1px solid #b5b5b5',
  borderRadius: 8,
}

/**
 * Hộp bắt buộc nhập tên khi khách mở web lần đầu.
 * Không có nút bỏ qua và không đóng bằng phím Escape: phải nhập tên mới dùng được web.
 */
export default function NamePrompt() {
  const [open, setOpen] = useState(() => {
    if (!supabase) return false // chưa cấu hình Supabase thì không lưu được tên
    if (window.location.pathname.startsWith('/admin')) return false
    return !getVisitorName()
  })
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const formRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden' // khóa cuộn trang phía sau
    inputRef.current?.focus()
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  const submit = (e) => {
    e.preventDefault()
    const name = setVisitorName(value)
    if (!name) {
      setError(`Nhập ít nhất ${MIN_NAME} ký tự.`)
      inputRef.current?.focus()
      return
    }
    setOpen(false)
    beatNow() // gửi tên lên bảng ngay, không chờ 30 giây
  }

  // Giữ phím Tab xoay vòng trong hộp, không nhảy ra trang phía sau
  const trapTab = (e) => {
    if (e.key !== 'Tab') return
    const items = formRef.current?.querySelectorAll('input, button')
    if (!items || items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      style={overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="name-prompt-title"
      onKeyDown={trapTab}
    >
      <form ref={formRef} style={card} onSubmit={submit} noValidate>
        <h2 id="name-prompt-title" style={{ margin: 0, fontSize: 20 }}>
          Bạn tên là gì?
        </h2>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: '#555' }}>
          Nhập tên để bắt đầu tham quan. Tên chỉ dùng để thống kê lượt tham quan, bạn không cần tạo tài khoản.
        </p>
        <input
          ref={inputRef}
          style={input}
          type="text"
          value={value}
          maxLength={MAX_NAME}
          placeholder="Ví dụ: Lan"
          aria-label="Tên của bạn"
          aria-invalid={error ? 'true' : 'false'}
          autoComplete="given-name"
          onChange={(e) => {
            setValue(e.target.value)
            if (error) setError('')
          }}
        />
        {error && (
          <p role="alert" style={{ margin: '0 0 8px', fontSize: 13, color: '#b00020' }}>
            {error}
          </p>
        )}
        <button className="btn" type="submit">
          Bắt đầu
        </button>
      </form>
    </div>
  )
}
