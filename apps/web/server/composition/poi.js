// Ghép dịch vụ POI: chỉ nạp những gì dịch vụ này cần (không kéo theo AI hay thống kê).
import { getConfig } from '../config.js';
import { createApp } from '../app.js';
import { userClient } from '../lib/supabase.js';
import { createAuthRepository } from '../repositories/auth.repository.js';
import { createPoiRepository } from '../repositories/poi.repository.js';
import { createPoiService } from '../services/poi.service.js';
import { createPoiController } from '../controllers/poi.controller.js';

export function buildPoi(cfg) {
  const service = createPoiService({ repoFor: (token) => createPoiRepository(userClient(cfg, token)) });
  return createPoiController(service);
}

export function createPoiApp(env = process.env) {
  const cfg = getConfig(env);
  const auth = createAuthRepository(cfg);
  return createApp({
    serviceName: 'poi-service',
    healthPath: '/pois/health',
    isAdmin: (token) => auth.isAdmin(token),
    controllers: { poi: buildPoi(cfg) },
  });
}
