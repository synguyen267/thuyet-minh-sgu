import test from 'node:test';
import assert from 'node:assert/strict';
import { poiName, pickNarration, shapePoiRow } from '../src/index.js';

const poi = { id: 'khu-a', name: { vi: 'Khu A', en: 'Building A' }, tts: { vi: 'Xin chào', en: 'Hello' }, audio: { en: 'https://x/a.mp3' } };

test('poiName: đúng ngôn ngữ, thiếu thì lùi về English rồi tiếng Việt rồi id', () => {
  assert.equal(poiName(poi, 'en'), 'Building A');
  assert.equal(poiName(poi, 'ja'), 'Building A');
  assert.equal(poiName({ id: 'x', name: { vi: 'Chỉ Việt' } }, 'ko'), 'Chỉ Việt');
  assert.equal(poiName({ id: 'x', name: {} }, 'vi'), 'x');
});

test('pickNarration: ưu tiên ngôn ngữ chọn, thiếu thì English', () => {
  assert.deepEqual(pickNarration(poi, 'vi'), { lang: 'vi', text: 'Xin chào', audioUrl: null });
  const ja = pickNarration(poi, 'ja');
  assert.equal(ja.lang, 'en');
  assert.equal(ja.audioUrl, 'https://x/a.mp3');
});

test('pickNarration: không có nội dung nào thì null', () => {
  assert.equal(pickNarration({ id: 'x', tts: { vi: '   ' } }, 'vi'), null);
});

test('shapePoiRow gom bản dịch theo ngôn ngữ và bỏ trường lồng', () => {
  const p = shapePoiRow({
    id: 'khu-a', lat: 10.1, lng: 106.1, poi_translation: [
      { lang: 'vi', name: 'Khu A', tts_script: 'Chào', audio_url: null, status: 'approved', description: null },
      { lang: 'en', name: 'Building A', tts_script: 'Hi', audio_url: 'u', status: 'draft', description: 'd' },
    ],
  });
  assert.equal(p.name.en, 'Building A');
  assert.equal(p.tts.vi, 'Chào');
  assert.equal(p.audio.en, 'u');
  assert.equal(p.status.en, 'draft');
  assert.equal('poi_translation' in p, false);
  assert.equal(p.lat, 10.1);
});

test('shapePoiRow chịu được điểm chưa có bản dịch nào', () => {
  const p = shapePoiRow({ id: 'x', poi_translation: null });
  assert.deepEqual(p.name, {});
});

import { slugify } from '../src/index.js';

test('slugify: bỏ dấu tiếng Việt và chuyển đ thành d', () => {
  assert.equal(slugify('Hội trường A'), 'hoi-truong-a');
  assert.equal(slugify('Khu thư viện (KLF)'), 'khu-thu-vien-klf');
  assert.equal(slugify('Đại học Sài Gòn'), 'dai-hoc-sai-gon');
});

test('slugify: chuỗi rỗng hoặc toàn ký tự lạ cho kết quả rỗng, mã quá dài được cắt', () => {
  assert.equal(slugify('  !!! '), '');
  assert.equal(slugify(null), '');
  assert.ok(slugify('a'.repeat(100)).length <= 40);
  assert.match(slugify('Tên rất dài '.repeat(10)), /^[a-z0-9-]{1,40}$/);
});
