// Ghép dịch vụ thống kê (Analytics): chỉ nạp repository và service thống kê.
import { getConfig } from '../config.js';
import { createApp } from '../app.js';
import { userClient } from '../lib/supabase.js';
import { createAuthRepository } from '../repositories/auth.repository.js';
import { createStatsRepository } from '../repositories/stats.repository.js';
import { createStatsService } from '../services/stats.service.js';
import { createStatsController } from '../controllers/stats.controller.js';

export function buildStats(cfg) {
  const service = createStatsService({ statsRepoFor: (token) => createStatsRepository(userClient(cfg, token)) });
  return createStatsController(service);
}

export function createAnalyticsApp(env = process.env) {
  const cfg = getConfig(env);
  const auth = createAuthRepository(cfg);
  return createApp({
    serviceName: 'analytics-service',
    healthPath: '/stats/health',
    isAdmin: (token) => auth.isAdmin(token),
    controllers: { stats: buildStats(cfg) },
  });
}
