import express from 'express';
import { badRequest } from '../errors.js';

const parse = express.json({ limit: '100kb' });

/**
 * Đọc nội dung JSON. Trên Vercel, nội dung có thể đã được đọc sẵn vào req.body (stream đã cạn)
 * nên nếu req.body đã là đối tượng thì dùng luôn, không đọc lại.
 */
export function readJson(req, res, next) {
  try {
    if (req.body !== undefined && typeof req.body === 'object') return next();
  } catch {
    return next(badRequest('Nội dung gửi lên không phải JSON hợp lệ.'));
  }
  return parse(req, res, (err) => next(err ? badRequest('Nội dung gửi lên không phải JSON hợp lệ.') : undefined));
}
