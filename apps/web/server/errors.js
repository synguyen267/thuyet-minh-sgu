// Lỗi có mã HTTP để các tầng ném lên, tầng ngoài cùng (middleware/errors.js) đổi thành câu trả lời JSON.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (m) => new HttpError(400, m);
export const unauthorized = (m) => new HttpError(401, m);
export const forbidden = (m) => new HttpError(403, m);
export const notFound = (m) => new HttpError(404, m);
export const conflict = (m) => new HttpError(409, m);

/** Đổi lỗi của Supabase (PostgREST) thành lỗi HTTP dễ hiểu. */
export function fromSupabase(error) {
  const code = error?.code;
  if (code === '42501') return forbidden('Không đủ quyền thực hiện thao tác này.');
  if (code === '23505') return conflict('Dữ liệu này đã tồn tại.');
  if (code === '23503') return conflict('Dữ liệu đang được dùng ở nơi khác nên chưa thực hiện được.');
  if (['23514', '22P02', 'P0001'].includes(code)) return badRequest(error.message);
  return new HttpError(502, error?.message || 'Lỗi cơ sở dữ liệu.');
}
