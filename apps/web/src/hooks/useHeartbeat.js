import { useEffect } from 'react'
import { supabase } from '../supabase.js'
import { getDeviceId } from '../lib/deviceId.js'
import { getVisitorName } from '../lib/visitorName.js'

const INTERVAL_MS = 15000 // báo mỗi 30 giây

let stopCurrent = null

/**
 * Gửi một tín hiệu "còn hoạt động" ngay lập tức.
 * Khách phải nhập tên trước mới được tính (trang /admin thì không cần).
 */
export async function beatNow() {
  if (!supabase) return
  // Tab bị ẩn hoặc khóa màn hình thì không báo, để thiết bị tự rớt khỏi danh sách
  if (document.visibilityState !== 'visible') return

  const name = getVisitorName()
  const isAdminPage = window.location.pathname.startsWith('/admin')
  if (!name && !isAdminPage) return // chưa nhập tên: chưa tính là đang hoạt động

  try {
    await supabase.rpc('heartbeat', {
      p_device: getDeviceId(),
      p_path: window.location.pathname + window.location.search,
      p_name: name || null,
      p_agent: navigator.userAgent || null,
    })
  } catch {
    // Lỗi mạng: bỏ qua, lần sau báo lại
  }
}

/** Báo "tôi rời đi" để thiết bị biến mất khỏi danh sách ngay. */
function leaveNow() {
  if (!supabase) return
  try {
    // keepalive: yêu cầu vẫn được gửi đi kể cả khi tab đang đóng
    fetch(`${supabase.supabaseUrl}/rest/v1/rpc/leave`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: supabase.supabaseKey,
        Authorization: `Bearer ${supabase.supabaseKey}`,
      },
      body: JSON.stringify({ p_device: getDeviceId() }),
    }).catch(() => {})
  } catch {
    // bỏ qua
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') leaveNow()
  else beatNow()
}
/**
 * Bắt đầu báo "thiết bị này còn hoạt động" lên Supabase.
 * Gọi nhiều lần cũng chỉ chạy một bộ đếm. Trả về hàm dừng.
 */

export function startHeartbeat() {
  if (!supabase) return () => {} // chưa cấu hình Supabase thì bỏ qua
  if (stopCurrent) return stopCurrent

 beatNow()
  const timer = setInterval(beatNow, INTERVAL_MS)
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', leaveNow)

  stopCurrent = () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pagehide', leaveNow)
    stopCurrent = null
  }
  return stopCurrent
}

/** Dùng trong một component React nếu bạn muốn gọi theo kiểu hook. */
export function useHeartbeat() {
  useEffect(() => startHeartbeat(), [])
}
