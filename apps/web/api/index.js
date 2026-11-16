// Cổng vào của Vercel: mọi yêu cầu /api/... đi vào ứng dụng Express trong thư mục server/.
import { createRealApp } from '../server/index.js';

export default createRealApp();
