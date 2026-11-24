import { HttpError } from '../errors.js';

const RETRY = [429, 500, 503];

/** Đổi mã lỗi của Gemini thành câu tiếng Việt dễ hiểu. */
function friendlyMessage(r, model) {
  if (r.status === 503) return 'AI đang quá tải (Google báo có nhiều người dùng cùng lúc). Hãy chờ vài giây rồi bấm thử lại.';
  if (r.status === 429) return 'Đã dùng hết số lần gọi AI cho phép trong một phút. Hãy chờ khoảng một phút rồi bấm thử lại.';
  if (r.status === 401 || r.status === 403) return 'Khóa Gemini không hợp lệ hoặc chưa được cấp quyền. Hãy kiểm tra GEMINI_API_KEY trên Vercel.';
  if (r.status === 404) return `Không tìm thấy model "${model}". Hãy đặt biến GEMINI_MODEL trên Vercel bằng tên model đang dùng được.`;
  return r.data?.error?.message || `Gemini trả về lỗi ${r.status}`;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Máy khách Gemini: ép trả về JSON, giảm thời gian suy nghĩ, tự thử lại tối đa hai lần khi lỗi tạm thời. */
export function createGemini({ apiKey, model, fetchFn, retryDelaysMs = [1500, 3000] }) {
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
      for (const delay of retryDelaysMs) { // lỗi tạm thời (quá tải, giới hạn tốc độ) thì chờ rồi thử lại
        if (!RETRY.includes(r.status)) break;
        await sleep(delay);
        r = await request(system, user, thinking);
      }
      if (!r.ok) throw new HttpError(502, friendlyMessage(r, model));
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
