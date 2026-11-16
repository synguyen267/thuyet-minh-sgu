import { forbidden, unauthorized } from '../errors.js';

/** Chỉ cho qua tài khoản quản trị. isAdmin(token) trả về true hoặc false. Gắn token vào req để các tầng sau dùng. */
export function requireAdmin(isAdmin) {
  return async (req, res, next) => {
    try {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!token) throw unauthorized('Hãy đăng nhập bằng tài khoản quản trị.');
      if (!(await isAdmin(token))) throw forbidden('Chỉ tài khoản quản trị được dùng chức năng này.');
      req.token = token;
      next();
    } catch (e) {
      next(e);
    }
  };
}
