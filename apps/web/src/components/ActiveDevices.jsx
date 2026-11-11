import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'

const REFRESH_MS = 15000
const MAX_ROWS = 20

function agoText(iso) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  return s < 60 ? `${s} giây trước` : `${Math.round(s / 60)} phút trước`
}

function labelOf(r) {
  if (r.display_name) return r.display_name
  return r.user_id ? 'Quản trị viên' : 'Khách chưa nhập tên'
}

export default function ActiveDevices() {
  const [rows, setRows] = useState([])
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!supabase) return undefined
    let alive = true

    const load = async () => {
      const { data, error } = await supabase
        .from('active_now')
        .select('*')
        .order('last_seen', { ascending: false })
      if (!alive) return
      if (error) {
        setErr(error.message)
      } else {
        setErr('')
        setRows(data ?? [])
      }
    }

    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  if (!supabase) return null

  const named = rows.filter((r) => r.display_name).length

  return (
    <>
      {err && <p className="note warn">Lỗi đếm thiết bị: {err}</p>}
      <div className="grid2 stats-cards">
        <div className="stat">
          <span>Thiết bị đang hoạt động</span>
          <strong>{rows.length}</strong>
        </div>
        <div className="stat">
          <span>Đã nhập tên</span>
          <strong>{named}</strong>
        </div>
      </div>
      {rows.length > 0 && (
        <ul className="poi-list">
          {rows.slice(0, MAX_ROWS).map((r) => (
            <li key={r.device_id}>
              <div className="poi-row static">
                <span className="poi-name">{labelOf(r)}</span>
                <span className="poi-meta">
                  {r.current_path || '/'}, {agoText(r.last_seen)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="note">Tính các thiết bị có tín hiệu trong 2 phút gần nhất, tự làm mới mỗi 15 giây.</p>
    </>
  )
}
