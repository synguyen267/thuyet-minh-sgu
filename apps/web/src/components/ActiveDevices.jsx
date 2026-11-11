import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'

const REFRESH_MS = 5000
const MAX_ROWS = 20

function agoText(iso) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  return s < 60 ? `${s} giây trước` : `${Math.round(s / 60)} phút trước`
}

function labelOf(r) {
  if (r.display_name) return r.display_name
  return r.user_id ? 'Quản trị viên' : 'Khách chưa nhập tên'
}

/** Đọc chuỗi user agent thành "Hệ điều hành, ứng dụng" cho dễ nhìn. */
function describeAgent(ua) {
  if (!ua) return ''
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iPhone/iPad'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'Mac'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Thiết bị khác'
  const app = /Zalo/i.test(ua)
    ? 'Zalo'
    : /FBAN|FBAV|FB_IAB/.test(ua)
      ? 'Facebook'
      : /Instagram/.test(ua)
        ? 'Instagram'
        : /Edg(?:A|iOS)?\//.test(ua)
          ? 'Edge'
          : /SamsungBrowser/.test(ua)
            ? 'Samsung Internet'
            : /OPR\/|Opera/.test(ua)
              ? 'Opera'
              : /Firefox|FxiOS/.test(ua)
                ? 'Firefox'
                : /Chrome|CriOS/.test(ua)
                  ? 'Chrome'
                  : /Safari/.test(ua)
                    ? 'Safari'
                    : ''
  return app ? `${os}, ${app}` : os
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

  const guests = rows.filter((r) => !r.user_id).length

  return (
    <>
      {err && <p className="note warn">Lỗi đếm thiết bị: {err}</p>}
      <div className="grid2 stats-cards">
        <div className="stat">
          <span>Thiết bị đang hoạt động</span>
          <strong>{rows.length}</strong>
        </div>
        <div className="stat">
          <span>Khách tham quan</span>
          <strong>{guests}</strong>
        </div>
      </div>
      {rows.length > 0 && (
        <ul className="poi-list">
          {rows.slice(0, MAX_ROWS).map((r) => (
            <li key={r.device_id}>
              <div className="poi-row static">
                <span className="poi-name">{labelOf(r)}</span>
                <span className="poi-meta">
                  {[describeAgent(r.user_agent), r.current_path || '/', agoText(r.last_seen)]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="note">Chỉ tính thiết bị đã nhập tên, có tín hiệu trong 45 giây gần nhất, tự làm mới mỗi 5 giây.</p>
    </>
  )
}
