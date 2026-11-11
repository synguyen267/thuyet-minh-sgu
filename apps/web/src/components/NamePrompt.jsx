import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase.js'
import {
  MAX_NAME,
  getVisitorName,
  isPromptSkipped,
  setVisitorName,
  skipPrompt,
} from '../lib/visitorName.js'
import { beatNow } from '../hooks/useHeartbeat.js'

const overlay = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  background: 'rgba(0, 0, 0, 0.45)',
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
  margin: '12px 0',
  padding: '10px 12px',
  fontSize: 16, // 16px để iPhone không tự phóng to khi bấm vào ô nhập
  border: '1px solid #b5b5b5',
  borderRadius: 8,
}

const skipBtn = {
  marginLeft: 8,
  padding: '10px 12px',
  border: 'none',
  background: 'transparent',
  color: '#555',
  fontSize: 14,
  cursor: 'pointer',
}

export default function NamePrompt() {
  const [open, setOpen] = useState(() => {
    if (!supabase) return false
    if (window.location.pathname.startsWith('/admin')) return false
    return !getVisitorName() && !isPromptSkipped()
  })
  const [value, setValue] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  if (!open) return null

  const submit = (e) => {
    e.preventDefault()
    const name = setVisitorName(value)
    if (!name) return
    setOpen(false)
    beatNow() // gửi tên lên bảng ngay, không chờ 30 giây
  }

  const skip = () => {
    skipPrompt()
    setOpen(false)
  }

  return (
    <div
      style={overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="name-prompt-title"
      onKeyDown={(e) => e.key === 'Escape' && skip()}
    >
      <form style={card} onSubmit={submit}>
        <h2 id="name-prompt-title" style={{ margin: 0, fontSize: 20 }}>
          Bạn tên là gì?
        </h2>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: '#555' }}>
          Tên chỉ dùng để thống kê lượt tham quan. Bạn không cần tạo tài khoản.
        </p>
        <input
          ref={inputRef}
          style={input}
          type="text"
          value={value}
          maxLength={MAX_NAME}
          placeholder="Ví dụ: Lan"
          aria-label="Tên của bạn"
          autoComplete="given-name"
          onChange={(e) => setValue(e.target.value)}
        />
        <button className="btn" type="submit" disabled={!value.trim()}>
          Bắt đầu
        </button>
        <button type="button" style={skipBtn} onClick={skip}>
          Bỏ qua
        </button>
      </form>
    </div>
  )
}
