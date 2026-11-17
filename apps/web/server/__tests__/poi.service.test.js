import test from 'node:test';
import assert from 'node:assert/strict';
import { createPoiService } from '../services/poi.service.js';
import { HttpError } from '../errors.js';

function fakeRepo(overrides = {}) {
  const calls = [];
  const rec = (name, ret) => async (...a) => { calls.push([name, ...a]); return typeof ret === 'function' ? ret(...a) : ret; };
  const repo = {
    insertPoi: rec('insertPoi'),
    updatePoi: rec('updatePoi'),
    deletePoi: rec('deletePoi'),
    insertTranslation: rec('insertTranslation'),
    upsertTranslation: rec('upsertTranslation'),
    countPlays: rec('countPlays', 0),
    ...overrides,
  };
  return { repo, calls };
}
const svc = (repo) => createPoiService({ repoFor: () => repo });
const rejectsWith = (p, status, re) => assert.rejects(p, (e) => e instanceof HttpError && e.status === status && (!re || re.test(e.message)));

test('tạo điểm: lưu ở trạng thái ẩn kèm tên tiếng Việt dạng nháp', async () => {
  const { repo, calls } = fakeRepo();
  const r = await svc(repo).create('t', { id: 'khu-a', name_vi: '  Khu A  ', tour_order: '7' });
  assert.deepEqual(r, { id: 'khu-a' });
  assert.deepEqual(calls[0], ['insertPoi', { id: 'khu-a', tour_order: 7, radius_m: 20, priority: 1, is_active: false }]);
  assert.deepEqual(calls[1], ['insertTranslation', { poi_id: 'khu-a', lang: 'vi', name: 'Khu A', status: 'draft', source: 'human' }]);
});

test('tạo điểm: mã sai hoặc thiếu tên bị từ chối 400, không ghi gì', async () => {
  const { repo, calls } = fakeRepo();
  await rejectsWith(svc(repo).create('t', { id: 'Khu A!', name_vi: 'x' }), 400, /Mã điểm/);
  await rejectsWith(svc(repo).create('t', { id: 'ok', name_vi: '   ' }), 400, /tên tiếng Việt/);
  await rejectsWith(svc(repo).create('t', { id: 'ok', name_vi: 'x', radius_m: 500 }), 400, /Bán kính/);
  assert.equal(calls.length, 0);
});

test('tạo điểm: lỗi ở bước lưu bản dịch thì xóa điểm vừa tạo (không để lại điểm mồ côi)', async () => {
  const boom = new HttpError(409, 'trùng');
  const { repo, calls } = fakeRepo({ insertTranslation: async () => { throw boom; } });
  await assert.rejects(svc(repo).create('t', { id: 'khu-a', name_vi: 'Khu A' }), boom);
  assert.deepEqual(calls.at(-1), ['deletePoi', 'khu-a']);
});

test('sửa điểm: chỉ ghi các trường được gửi và đã kiểm tra', async () => {
  const { repo, calls } = fakeRepo();
  await svc(repo).update('t', 'khu-a', { lat: '10.76', lng: 106.68, radius_m: 30, is_active: true, extra_zones: [{ lat: 10.7, lng: 106.6, radius_m: 15 }] });
  assert.deepEqual(calls[0], ['updatePoi', 'khu-a', {
    lat: 10.76, lng: 106.68, radius_m: 30, is_active: true, extra_zones: [{ lat: 10.7, lng: 106.6, radius_m: 15 }],
  }]);
});

test('sửa điểm: vĩ độ và kinh độ phải đi cùng nhau, trống cả hai thì được', async () => {
  const { repo, calls } = fakeRepo();
  await rejectsWith(svc(repo).update('t', 'a', { lat: 10, lng: '' }), 400, /cả vĩ độ và kinh độ/);
  await svc(repo).update('t', 'a', { lat: '', lng: null });
  assert.deepEqual(calls[0], ['updatePoi', 'a', { lat: null, lng: null }]);
});

test('sửa điểm: từ chối giá trị sai, trường lạ bị bỏ qua, không có gì để sửa thì 400', async () => {
  const { repo, calls } = fakeRepo();
  await rejectsWith(svc(repo).update('t', 'a', { radius_m: 4 }), 400, /Bán kính/);
  await rejectsWith(svc(repo).update('t', 'a', { priority: 11 }), 400, /Ưu tiên/);
  await rejectsWith(svc(repo).update('t', 'a', { is_active: 'yes' }), 400);
  await rejectsWith(svc(repo).update('t', 'a', { extra_zones: Array(13).fill({ lat: 1, lng: 1, radius_m: 10 }) }), 400, /tối đa 12/);
  await rejectsWith(svc(repo).update('t', 'a', { id: 'hack', created_at: 'x' }), 400, /Không có gì/);
  assert.equal(calls.length, 0);
});

test('sửa điểm: đường dẫn ảnh và bản đồ chỉ nhận http(s), chặn javascript:', async () => {
  const { repo, calls } = fakeRepo();
  await rejectsWith(svc(repo).update('t', 'a', { map_url: 'javascript:alert(1)' }), 400, /http/);
  await rejectsWith(svc(repo).update('t', 'a', { image_url: 'data:text/html,x' }), 400, /http/);
  await svc(repo).update('t', 'a', { image_url: 'https://x.co/a.jpg', map_url: '' });
  assert.deepEqual(calls[0], ['updatePoi', 'a', { image_url: 'https://x.co/a.jpg', map_url: null }]);
  await rejectsWith(svc(repo).update('t', 'a', { image_url: '//evil.com/x.jpg' }), 400, /http/);
  await svc(repo).update('t', 'a', { image_url: '/images/cong-chinh.jpg' }); // đường dẫn tương đối của chính trang vẫn được nhận
  assert.deepEqual(calls[1], ['updatePoi', 'a', { image_url: '/images/cong-chinh.jpg' }]);
});

test('lưu bản dịch: kiểm tra ngôn ngữ, tên, trạng thái; nguồn luôn là human', async () => {
  const { repo, calls } = fakeRepo();
  await rejectsWith(svc(repo).saveTranslation('t', 'a', 'fr', { name: 'x' }), 400, /Ngôn ngữ/);
  await rejectsWith(svc(repo).saveTranslation('t', 'a', 'en', { name: '' }), 400, /tên điểm/);
  await rejectsWith(svc(repo).saveTranslation('t', 'a', 'en', { name: 'x', status: 'published' }), 400, /Trạng thái/);
  await svc(repo).saveTranslation('t', 'a', 'en', { name: ' Block A ', tts_script: '', status: 'approved', source: 'ai' });
  assert.deepEqual(calls[0], ['upsertTranslation', { poi_id: 'a', lang: 'en', name: 'Block A', tts_script: null, audio_url: null, status: 'approved', source: 'human' }]);
});

test('BR-15: điểm đã có lượt nghe thì không được xóa (409), chưa có thì xóa được', async () => {
  const used = fakeRepo({ countPlays: async () => 3 });
  await rejectsWith(svc(used.repo).remove('t', 'khu-a'), 409, /3 lượt nghe/);
  assert.ok(!used.calls.some((c) => c[0] === 'deletePoi'));
  const fresh = fakeRepo({ countPlays: async () => 0 });
  assert.deepEqual(await svc(fresh.repo).remove('t', 'khu-a'), { id: 'khu-a' });
  assert.deepEqual(fresh.calls.at(-1), ['deletePoi', 'khu-a']);
});

test('mã điểm không hợp lệ ở đường dẫn bị từ chối', async () => {
  const { repo } = fakeRepo();
  await rejectsWith(svc(repo).remove('t', '../etc'), 400, /Mã điểm/);
});
