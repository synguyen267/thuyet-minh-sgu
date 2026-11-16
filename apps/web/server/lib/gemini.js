import { HttpError } from '../errors.js';

const RETRY = [429, 500, 503];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Máy khách Gemini: ép trả về JSON, giảm thời gian suy nghĩ, tự thử lại khi lỗi tạm thời. */
export function createGemini({ apiKey, model, fetchFn, retryDelayMs = 1200 }) {
  async function request(system, user, thinking) {
    if (!apiKey) throw new HttpError(500, 'Chưa cấu hình GEMINI_API_KEY trên Vercel.');
    const generationConfig = { responseMimeType: 'application/json', temperature: 0.6 };
    if (thinking) generationConfig.thinkingConfig = { thinkingLevel: 'low' };
    const f = fetchFn ?? globalThis.fetch;
    const r = await f(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig,
      }),
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  }

  return {
    async generateJson(system, user) {
      let thinking = true;
      let r = await request(system, user, thinking);
      if (r.status === 400 && thinking) { // model không nhận cấu hình suy nghĩ
        thinking = false;
        r = await request(system, user, thinking);
      }
      if (RETRY.includes(r.status)) {
        await sleep(retryDelayMs);
        r = await request(system, user, thinking);
      }
      if (!r.ok) throw new HttpError(502, r.data?.error?.message || `Gemini trả về lỗi ${r.status}`);
      const raw = (r.data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
      const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      try {
        return JSON.parse(clean);
      } catch {
        throw new HttpError(502, 'AI trả về nội dung không đọc được. Hãy bấm thử lại.');
      }
    },
  };
}
