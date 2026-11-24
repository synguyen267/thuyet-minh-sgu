import express from 'express';
import { requireAdmin } from './middleware/auth.js';
import { readJson } from './middleware/json.js';
import { errorHandler, notFoundHandler, wrap } from './middleware/errors.js';

/**
 * Tạo ứng dụng Express. Nhận isAdmin và các controller từ ngoài vào (tiêm phụ thuộc),
 * nên kiểm thử được mà không cần Supabase hay Gemini.
 * Dịch vụ nào có controller thì mới có đường dẫn của dịch vụ đó: một dịch vụ độc lập chỉ truyền controller của chính nó.
 */
export function createApp({ serviceName = 'thuyet-minh-sgu-api', healthPath = '/health', isAdmin, controllers }) {
  const { poi, ai, stats } = controllers;
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(readJson);

  const api = express.Router();
  const admin = requireAdmin(isAdmin);

  api.get(healthPath, (req, res) => res.json({ ok: true, service: serviceName, time: new Date().toISOString() }));

  if (poi) { // Dịch vụ điểm (POI)
    api.post('/pois', admin, wrap(poi.create));
    api.patch('/pois/:id', admin, wrap(poi.update));
    api.put('/pois/:id/translations/:lang', admin, wrap(poi.saveTranslation));
    api.get('/pois/:id/plays', admin, wrap(poi.plays));
    api.delete('/pois/:id', admin, wrap(poi.remove));
  }

  if (ai) { // Dịch vụ AI
    api.post('/ai/draft', admin, wrap(ai.draft));
    api.post('/ai/translate', admin, wrap(ai.translate));
  }

  if (stats) { // Dịch vụ thống kê (Analytics)
    api.get('/stats', admin, wrap(stats.overview));
    api.get('/stats/heat', admin, wrap(stats.heat));
  }

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
