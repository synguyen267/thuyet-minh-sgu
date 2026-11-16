import { badRequest } from '../errors.js';

export const LANG_CODES = ['vi', 'en', 'zh', 'ja', 'ko'];

/** Chuỗi đã cắt khoảng trắng; bắt buộc hoặc không, và không quá max ký tự. */
export function text(v, { max, required = false, label }) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && !s) throw badRequest(`Thiếu ${label}.`);
  if (s.length > max) throw badRequest(`${label} quá dài (tối đa ${max} ký tự).`);
  return s;
}

export function intInRange(v, min, max, label) {
  const n = Number(v);
  if (v === '' || v == null || !Number.isInteger(n) || n < min || n > max) {
    throw badRequest(`${label} phải là số nguyên từ ${min} đến ${max}.`);
  }
  return n;
}

export function numInRange(v, min, max, label) {
  const n = Number(v);
  if (v === '' || v == null || !Number.isFinite(n) || n < min || n > max) {
    throw badRequest(`${label} không hợp lệ (từ ${min} đến ${max}).`);
  }
  return n;
}

/** Đường dẫn http(s) hoặc null. Chặn javascript: và các kiểu khác vì giá trị này được dùng làm href và src. */
export function urlOrNull(v, label) {
  if (v == null || v === '') return null;
  const s = text(v, { max: 1000, label });
  if (!/^https?:\/\//i.test(s)) throw badRequest(`${label} phải bắt đầu bằng http:// hoặc https://.`);
  return s;
}
