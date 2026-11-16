// Nơi duy nhất biết các tầng ghép với nhau như thế nào (composition root).
import { getConfig } from './config.js';
import { createApp } from './app.js';
import { userClient } from './lib/supabase.js';
import { createGemini } from './lib/gemini.js';
import { createAuthRepository } from './repositories/auth.repository.js';
import { createPoiRepository } from './repositories/poi.repository.js';
import { createStatsRepository } from './repositories/stats.repository.js';
import { createPoiService } from './services/poi.service.js';
import { createAiService } from './services/ai.service.js';
import { createStatsService } from './services/stats.service.js';
import { createPoiController } from './controllers/poi.controller.js';
import { createAiController } from './controllers/ai.controller.js';
import { createStatsController } from './controllers/stats.controller.js';

export function createRealApp(env = process.env) {
  const cfg = getConfig(env);
  const auth = createAuthRepository(cfg);
  const gemini = createGemini({ apiKey: cfg.geminiKey, model: cfg.geminiModel });

  const poiService = createPoiService({ repoFor: (token) => createPoiRepository(userClient(cfg, token)) });
  const statsService = createStatsService({ statsRepoFor: (token) => createStatsRepository(userClient(cfg, token)) });
  const aiService = createAiService({ gemini });

  return createApp({
    isAdmin: (token) => auth.isAdmin(token),
    controllers: {
      poi: createPoiController(poiService),
      ai: createAiController(aiService),
      stats: createStatsController(statsService),
    },
  });
}
