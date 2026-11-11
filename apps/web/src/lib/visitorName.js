const NAME_KEY = 'visitor_name'
const SKIP_KEY = 'visitor_name_skipped'

export const MAX_NAME = 40

/** Tên khách đã nhập (lưu trong trình duyệt), rỗng nếu chưa có. */
export function getVisitorName() {
  try {
    return (localStorage.getItem(NAME_KEY) || '').trim()
  } catch {
    return ''
  }
}

/** Lưu tên, trả về tên đã làm sạch (bỏ khoảng trắng thừa, tối đa 40 ký tự). */
export function setVisitorName(name) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME)
  try {
    if (clean) localStorage.setItem(NAME_KEY, clean)
  } catch {
    // Trình duyệt chặn localStorage: tên chỉ có hiệu lực lần gửi này
  }
  return clean
}

/** Khách bấm "Bỏ qua": không hỏi lại trong phiên này (đóng trình duyệt thì hỏi lại). */
export function isPromptSkipped() {
  try {
    return sessionStorage.getItem(SKIP_KEY) === '1'
  } catch {
    return false
  }
}

export function skipPrompt() {
  try {
    sessionStorage.setItem(SKIP_KEY, '1')
  } catch {
    // bỏ qua
  }
}
