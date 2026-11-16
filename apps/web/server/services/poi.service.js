import { badRequest, conflict } from '../errors.js';
import { LANG_CODES, intInRange, numInRange, text, urlOrNull } from '../lib/validate.js';

const SLUG = /^[a-z0-9-]{1,60}$/;
const STATUSES = ['draft', 'approved'];

function checkId(id) {
  if (!SLUG.test(String(id ?? ''))) throw badRequest('Mã điểm chỉ gồm chữ thường, số và dấu gạch ngang (tối đa 60 ký tự).');
  return id;
}

function zonesOf(list) {
  if (!Array.isArray(list)) throw badRequest('Vùng phụ phải là một danh sách.');
  if (list.length > 12) throw badRequest('Mỗi điểm có tối đa 12 vùng phụ.');
  return list.map((z, i) => ({
    lat: numInRange(z?.lat, -90, 90, `Vùng phụ ${i + 1}: vĩ độ`),
    lng: numInRange(z?.lng, -180, 180, `Vùng phụ ${i + 1}: kinh độ`),
    radius_m: intInRange(z?.radius_m, 5, 200, `Vùng phụ ${i + 1}: bán kính`),
  }));
}

/**
 * Nghiệp vụ về điểm và bản dịch. repoFor(token) trả về repository đã gắn với người gọi.
 * Kiểm tra dữ liệu ở đây (không tin giao diện), rồi mới giao cho repository ghi.
 */
export function createPoiService({ repoFor }) {
  return {
    /** Tạo điểm mới ở trạng thái ẨN, kèm tên tiếng Việt dạng nháp. Lỗi ở bước hai thì hoàn tác bước một. */
    async create(token, input = {}) {
      const id = checkId(text(input.id, { max: 60, required: true, label: 'mã điểm' }));
      const name_vi = text(input.name_vi, { max: 100, required: true, label: 'tên tiếng Việt' });
      const tour_order = input.tour_order == null || input.tour_order === '' ? null : intInRange(input.tour_order, 0, 999, 'Thứ tự tuyến');
      const radius_m = input.radius_m == null ? 20 : intInRange(input.radius_m, 5, 200, 'Bán kính');
      const priority = input.priority == null ? 1 : intInRange(input.priority, 0, 10, 'Ưu tiên');
      const repo = repoFor(token);
      await repo.insertPoi({ id, tour_order, radius_m, priority, is_active: false });
      try {
        await repo.insertTranslation({ poi_id: id, lang: 'vi', name: name_vi, status: 'draft', source: 'human' });
      } catch (e) {
        await repo.deletePoi(id).catch(() => {}); // không để lại điểm mồ côi
        throw e;
      }
      return { id };
    },

    /** Sửa các trường của điểm. Chỉ nhận các trường được phép, trường nào gửi lên mới được kiểm tra và ghi. */
    async update(token, id, input = {}) {
      checkId(id);
      const f = {};
      if ('lat' in input || 'lng' in input) {
        const lat = input.lat == null || input.lat === '' ? null : numInRange(input.lat, -90, 90, 'Vĩ độ');
        const lng = input.lng == null || input.lng === '' ? null : numInRange(input.lng, -180, 180, 'Kinh độ');
        if ((lat === null) !== (lng === null)) throw badRequest('Nhập đủ cả vĩ độ và kinh độ, hoặc để trống cả hai.');
        f.lat = lat;
        f.lng = lng;
      }
      if ('radius_m' in input) f.radius_m = intInRange(input.radius_m, 5, 200, 'Bán kính');
      if ('priority' in input) f.priority = intInRange(input.priority, 0, 10, 'Ưu tiên');
      if ('tour_order' in input) f.tour_order = input.tour_order == null || input.tour_order === '' ? null : intInRange(input.tour_order, 0, 999, 'Thứ tự tuyến');
      if ('is_active' in input) {
        if (typeof input.is_active !== 'boolean') throw badRequest('Trạng thái hiển thị phải là đúng hoặc sai.');
        f.is_active = input.is_active;
      }
      if ('image_url' in input) f.image_url = urlOrNull(input.image_url, 'Đường dẫn ảnh');
      if ('map_url' in input) f.map_url = urlOrNull(input.map_url, 'Liên kết bản đồ');
      if ('extra_zones' in input) f.extra_zones = zonesOf(input.extra_zones);
      if (Object.keys(f).length === 0) throw badRequest('Không có gì để cập nhật.');
      await repoFor(token).updatePoi(id, f);
      return { id };
    },

    /** Lưu bản dịch của một ngôn ngữ (thêm mới hoặc ghi đè). Nguồn luôn ghi là người nhập. */
    async saveTranslation(token, id, lang, input = {}) {
      checkId(id);
      if (!LANG_CODES.includes(lang)) throw badRequest('Ngôn ngữ không hợp lệ.');
      const name = text(input.name, { max: 100, required: true, label: 'tên điểm' });
      const tts_script = text(input.tts_script, { max: 6000, label: 'lời thuyết minh' }) || null;
      const audio_url = urlOrNull(input.audio_url, 'Đường dẫn audio');
      const status = input.status ?? 'draft';
      if (!STATUSES.includes(status)) throw badRequest('Trạng thái phải là draft hoặc approved.');
      await repoFor(token).upsertTranslation({ poi_id: id, lang, name, tts_script, audio_url, status, source: 'human' });
      return { id, lang };
    },

    async countPlays(token, id) {
      checkId(id);
      return { plays: await repoFor(token).countPlays(id) };
    },

    /** BR-15: chỉ xóa hẳn điểm chưa có lượt nghe; điểm đã có lượt nghe thì phải ẩn để giữ số liệu. */
    async remove(token, id) {
      checkId(id);
      const repo = repoFor(token);
      const n = await repo.countPlays(id);
      if (n > 0) throw conflict(`Điểm này đã có ${n} lượt nghe. Hãy bỏ tick "Hiện cho khách" để ẩn thay vì xóa, để giữ số liệu.`);
      await repo.deletePoi(id);
      return { id };
    },
  };
}
