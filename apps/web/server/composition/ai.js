// Ghép dịch vụ AI: chỉ nạp Gemini và service AI.
import { getConfig } from '../config.js';
import { createApp } from '../app.js';
import { createGemini } from '../lib/gemini.js';
import { createAuthRepository } from '../repositories/auth.repository.js';
import { createAiService } from '../services/ai.service.js';
import { createAiController } from '../controllers/ai.controller.js';

export function buildAi(cfg) {
  const gemini = createGemini({ apiKey: cfg.geminiKey, model: cfg.geminiModel });
  return createAiController(createAiService({ gemini }));
}

export function createAiApp(env = process.env) {
  const cfg = getConfig(env);
  const auth = createAuthRepository(cfg);
  return createApp({
    serviceName: 'ai-service',
    healthPath: '/ai/health',
    isAdmin: (token) => auth.isAdmin(token),
    controllers: { ai: buildAi(cfg) },
  });
}
