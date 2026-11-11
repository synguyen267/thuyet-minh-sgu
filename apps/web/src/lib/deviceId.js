const KEY = 'device_id'

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Dự phòng cho trình duyệt cũ
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function getDeviceId() {
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = makeId()
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    // Trình duyệt chặn localStorage: dùng ID tạm cho phiên này
    return makeId()
  }
}
