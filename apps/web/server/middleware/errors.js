import { HttpError } from '../errors.js';

/** Bọc hàm xử lý bất đồng bộ để lỗi đi vào middleware báo lỗi (Express 4 và 5 đều chạy đúng). */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Không tìm thấy.' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  return res.status(500).json({ error: 'Lỗi máy chủ.' });
}
