import { useEffect } from 'react'
import { supabase } from '../supabase.js'
import { getDeviceId } from '../lib/deviceId.js'

const INTERVAL_MS = 30000 // báo mỗi 30 giây

let stopCurrent = null

/**
 * Bắt đầu báo "thiết bị này còn hoạt động" lên Supabase.
 * Gọi nhiều lần cũng chỉ chạy một bộ đếm. Trả về hàm dừng.
 */
export function startHeartbeat() {
  if (!supabase) return () => {} // chưa cấu hình Supabase thì bỏ qua
  if (stopCurrent) return stopCurrent

  const deviceId = getDeviceId()

  const beat = async () => {
    // Tab bị ẩn hoặc khóa màn hình thì không báo, để thiết bị tự rớt khỏi danh sách
    if (document.visibilityState !== 'visible') return
    try {
      await supabase.rpc('heartbeat', {
        p_device: deviceId,
        p_path: window.location.pathname + window.location.search,
      })
    } catch {
      // Lỗi mạng: bỏ qua, lần sau báo lại
    }
  }

  beat()
  const timer = setInterval(beat, INTERVAL_MS)
  document.addEventListener('visibilitychange', beat)

  stopCurrent = () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', beat)
    stopCurrent = null
  }
  return stopCurrent
}

/** Dùng trong một component React nếu bạn muốn gọi theo kiểu hook. */
export function useHeartbeat() {
  useEffect(() => startHeartbeat(), [])
}
