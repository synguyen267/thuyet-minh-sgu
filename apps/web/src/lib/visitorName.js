const NAME_KEY = 'visitor_name'

export const MIN_NAME = 2
export const MAX_NAME = 40

// Dự phòng khi trình duyệt chặn localStorage (ví dụ một số chế độ riêng tư)
let memoryName = ''

function cleanName(raw) {
  return String(raw || '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME)
}

/** Tên khách đã nhập, rỗng nếu chưa có. */
export function getVisitorName() {
  if (memoryName) return memoryName
  try {
    return cleanName(localStorage.getItem(NAME_KEY))
  } catch {
    return ''
  }
}

/** Lưu tên nếu hợp lệ (ít nhất 2 ký tự). Trả về tên đã làm sạch, hoặc '' nếu không hợp lệ. */
export function setVisitorName(raw) {
  const clean = cleanName(raw)
  if (clean.length < MIN_NAME) return ''
  memoryName = clean
  try {
    localStorage.setItem(NAME_KEY, clean)
  } catch {
    // Không lưu được lâu dài: tên vẫn dùng được trong phiên này
  }
  return clean
}
