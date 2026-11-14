// Hàm máy chủ trên Vercel: AI soạn nháp và dịch lời thuyết minh (FR-16).
// Khóa Gemini chỉ nằm ở biến môi trường GEMINI_API_KEY trên Vercel, không bao giờ đưa xuống trình duyệt.
// Chỉ tài khoản quản trị (hàm is_admin() của Supabase) mới gọi được.

export const config = { maxDuration: 30 };

const LANG_NAMES = { vi: 'tiếng Việt', en: 'English', zh: 'Chinese (Simplified, 简体中文)', ja: 'Japanese (日本語)', ko: 'Korean (한국어)' };
const LANGS = Object.keys(LANG_NAMES);
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

/** Hỏi Supabase xem người gửi token có phải admin không (dùng chính token của họ, nên RLS và is_admin() tự quyết định). */
async function isAdmin(token) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!r.ok) return false;
    return (await r.json()) === true;
  } catch {
    return false;
  }
}

/** Gọi Gemini, ép trả về JSON rồi đọc ra đối tượng. */
async function gemini(system, user) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.message || `Gemini trả về lỗi ${r.status}`);
  const raw = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(clean);
  } catch {
    throw new Error('AI trả về nội dung không đọc được. Hãy bấm thử lại.');
  }
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

async function draft(body) {
  const name = str(body.name, 100);
  const notes = str(body.notes, 2000);
  if (!name) throw new Error('Thiếu tên điểm.');
  const system =
    'Bạn viết lời thuyết minh cho khách tham quan khuôn viên Đại học Sài Gòn (273 An Dương Vương, TP. Hồ Chí Minh). ' +
    'Lời thuyết minh sẽ được máy đọc thành tiếng khi khách đi bộ tới gần điểm đó. ' +
    'Viết bằng tiếng Việt, giọng thân thiện như một người bạn dẫn khách đi chơi, 80 đến 120 từ, các câu ngắn, ' +
    'không dùng ký hiệu, gạch đầu dòng, markdown hay emoji. ' +
    'Chỉ dùng thông tin có trong phần "Ý chính". Tuyệt đối không bịa số liệu, năm tháng, tên người hay sự kiện; ' +
    'nếu ý chính ít thì viết ngắn và chung chung hơn thay vì tự thêm chi tiết. ' +
    'Trả về JSON đúng dạng {"text": "<lời thuyết minh>"} và không gì khác.';
  const user = `Tên điểm: ${name}\nÝ chính: ${notes || '(không có, hãy viết ngắn gọn, chung chung)'}`;
  const out = await gemini(system, user);
  const text = str(out?.text, 4000);
  if (!text) throw new Error('AI không soạn được nội dung. Hãy bấm thử lại.');
  return { text };
}

async function translate(body) {
  const name = str(body.name, 100);
  const text = str(body.text, 4000);
  const targets = Array.isArray(body.targets) ? body.targets.filter((l) => LANGS.includes(l) && l !== 'vi') : [];
  if (!name || !text) throw new Error('Cần có tên và lời thuyết minh tiếng Việt để dịch.');
  if (targets.length === 0) throw new Error('Chưa chọn ngôn ngữ cần dịch.');
  const list = targets.map((l) => `"${l}" = ${LANG_NAMES[l]}`).join('; ');
  const system =
    'Bạn là người dịch lời thuyết minh du lịch từ tiếng Việt sang các ngôn ngữ khác. ' +
    'Bản dịch sẽ được máy đọc thành tiếng, nên viết tự nhiên, câu ngắn, giữ nguyên ý nghĩa, không thêm hay bớt thông tin, ' +
    'không dùng markdown hay emoji. Giữ nguyên tên riêng (ví dụ Đại học Sài Gòn) theo cách gọi thông dụng của ngôn ngữ đích. ' +
    `Các ngôn ngữ cần dịch: ${list}. ` +
    'Trả về JSON đúng dạng {"<mã ngôn ngữ>": {"name": "<tên điểm đã dịch>", "text": "<lời thuyết minh đã dịch>"}} với đủ các mã yêu cầu và không gì khác.';
  const out = await gemini(system, `Tên điểm: ${name}\nLời thuyết minh:\n${text}`);
  const result = {};
  for (const l of targets) {
    const n = str(out?.[l]?.name, 100);
    const t = str(out?.[l]?.text, 6000);
    if (!n || !t) throw new Error(`AI chưa dịch được sang ${LANG_NAMES[l]}. Hãy bấm thử lại.`);
    result[l] = { name: n, text: t };
  }
  return result;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Chỉ nhận yêu cầu POST.' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên Vercel.' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Chưa cấu hình Supabase cho hàm máy chủ.' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || !(await isAdmin(token))) return res.status(403).json({ error: 'Chỉ tài khoản quản trị được dùng AI.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {};
    if (body.action === 'draft') return res.status(200).json({ result: await draft(body) });
    if (body.action === 'translate') return res.status(200).json({ result: await translate(body) });
    return res.status(400).json({ error: 'Yêu cầu không hợp lệ.' });
  } catch (e) {
    return res.status(502).json({ error: e.message || 'Lỗi không xác định.' });
  }
}
