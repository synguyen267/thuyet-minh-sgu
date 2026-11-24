// Bản gộp cả ba dịch vụ trong một ứng dụng: dùng khi chạy ở máy (node server/start.js) hoặc trên một máy chủ Node.
// Trên Vercel, mỗi dịch vụ chạy thành một hàm riêng: xem api/poi.js, api/ai.js, api/analytics.js.
import { getConfig } from './config.js';
import { createApp } from './app.js';
import { createAuthRepository } from './repositories/auth.repository.js';
import { buildPoi } from './composition/poi.js';
import { buildAi } from './composition/ai.js';
import { buildStats } from './composition/analytics.js';

export { createPoiApp } from './composition/poi.js';
export { createAiApp } from './composition/ai.js';
export { createAnalyticsApp } from './composition/analytics.js';

export function createRealApp(env = process.env) {
  const cfg = getConfig(env);
  const auth = createAuthRepository(cfg);
  return createApp({
    isAdmin: (token) => auth.isAdmin(token),
    controllers: { poi: buildPoi(cfg), ai: buildAi(cfg), stats: buildStats(cfg) },
  });
}
