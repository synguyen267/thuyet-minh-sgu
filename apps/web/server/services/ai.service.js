import { HttpError, badRequest } from '../errors.js';
import { LANG_CODES, text } from '../lib/validate.js';

const LANG_NAMES = {
  vi: 'tiếng Việt',
  en: 'English',
  zh: 'Chinese (Simplified, 简体中文)',
  ja: 'Japanese (日本語)',
  ko: 'Korean (한국어)',
};

/** AI soạn nháp và dịch lời thuyết minh. Kết quả chỉ là bản nháp; việc duyệt do người làm ở trang quản trị. */
export function createAiService({ gemini }) {
  async function translateOne(lang, name, body) {
    const system =
      `Bạn là người dịch lời thuyết minh du lịch từ tiếng Việt sang ${LANG_NAMES[lang]}. ` +
      'Bản dịch sẽ được máy đọc thành tiếng, nên viết tự nhiên, câu ngắn, giữ nguyên ý nghĩa, không thêm hay bớt thông tin, ' +
      'không dùng markdown hay emoji. Giữ nguyên tên riêng (ví dụ Đại học Sài Gòn) theo cách gọi thông dụng của ngôn ngữ đích. ' +
      'Trả về JSON đúng dạng {"name": "<tên điểm đã dịch>", "text": "<lời thuyết minh đã dịch>"} và không gì khác.';
    const out = await gemini.generateJson(system, `Tên điểm: ${name}\nLời thuyết minh:\n${body}`);
    const n = text(out?.name, { max: 100, label: 'tên đã dịch' });
    const t = text(out?.text, { max: 6000, label: 'bản dịch' });
    if (!n || !t) throw new HttpError(502, `AI chưa dịch được sang ${LANG_NAMES[lang]}. Hãy bấm thử lại.`);
    return { name: n, text: t };
  }

  return {
    async draft(input = {}) {
      const name = text(input.name, { max: 100, required: true, label: 'tên điểm' });
      const notes = text(input.notes, { max: 2000, label: 'ý chính' });
      const system =
        'Bạn viết lời thuyết minh cho khách tham quan khuôn viên Đại học Sài Gòn (273 An Dương Vương, TP. Hồ Chí Minh). ' +
        'Lời thuyết minh sẽ được máy đọc thành tiếng khi khách đi bộ tới gần điểm đó. ' +
        'Viết bằng tiếng Việt, giọng thân thiện như một người bạn dẫn khách đi chơi, 80 đến 120 từ, các câu ngắn, ' +
        'không dùng ký hiệu, gạch đầu dòng, markdown hay emoji. ' +
        'Chỉ dùng thông tin có trong phần "Ý chính". Tuyệt đối không bịa số liệu, năm tháng, tên người hay sự kiện; ' +
        'nếu ý chính ít thì viết ngắn và chung chung hơn thay vì tự thêm chi tiết. ' +
        'Trả về JSON đúng dạng {"text": "<lời thuyết minh>"} và không gì khác.';
      const user = `Tên điểm: ${name}\nÝ chính: ${notes || '(không có, hãy viết ngắn gọn, chung chung)'}`;
      const out = await gemini.generateJson(system, user);
      const t = text(out?.text, { max: 4000, label: 'nội dung' });
      if (!t) throw new HttpError(502, 'AI không soạn được nội dung. Hãy bấm thử lại.');
      return { text: t };
    },

    /** Mỗi ngôn ngữ một yêu cầu, chạy song song nên tổng thời gian chỉ bằng ngôn ngữ chậm nhất. */
    async translate(input = {}) {
      const name = text(input.name, { max: 100, required: true, label: 'tên điểm' });
      const body = text(input.text, { max: 4000, required: true, label: 'lời thuyết minh tiếng Việt' });
      const targets = Array.isArray(input.targets) ? input.targets.filter((l) => LANG_CODES.includes(l) && l !== 'vi') : [];
      if (targets.length === 0) throw badRequest('Chưa chọn ngôn ngữ cần dịch.');
      const entries = await Promise.all(targets.map(async (l) => [l, await translateOne(l, name, body)]));
      return Object.fromEntries(entries);
    },
  };
}
