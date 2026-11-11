import { useEffect } from 'react'
import { supabase } from '../supabase.js'
import { getDeviceId } from '../lib/deviceId.js'
import { getVisitorName } from '../lib/visitorName.js'

const INTERVAL_MS = 30000 // báo mỗi 30 giây

let stopCurrent = null

/** Gửi một tín hiệu "còn hoạt động" ngay lập tức (kèm tên khách nếu đã nhập). */
export async function beatNow() {
  if (!supabase) return
  // Tab bị ẩn hoặc khóa màn hình thì không báo, để thiết bị tự rớt khỏi danh sách
  if (document.visibilityState !== 'visible') return
  try {
    await supabase.rpc('heartbeat', {
      p_device: getDeviceId(),
      p_path: window.location.pathname + window.location.search,
      p_name: getVisitorName() || null,
    })
  } catch {
    // Lỗi mạng: bỏ qua, lần sau báo lại
  }
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
  document.addEventListener('visibilitychange', beatNow)

  stopCurrent = () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', beatNow)
    stopCurrent = null
  }
  return stopCurrent
}

/** Dùng trong một component React nếu bạn muốn gọi theo kiểu hook. */
export function useHeartbeat() {
  useEffect(() => startHeartbeat(), [])
}
