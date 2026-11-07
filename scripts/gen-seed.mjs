// Sinh supabase/seed.sql từ packages/core/data/pois.sample.json
// Dùng: npm run db:seed   (sau đó dán nội dung seed.sql vào Supabase SQL Editor)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(root, 'packages/core/data/pois.sample.json'), 'utf8'));

const str = (s) => (s == null ? 'null' : `'${String(s).replaceAll("'", "''")}'`);
const num = (n) => (Number.isFinite(n) ? String(n) : 'null');

const lines = [
  '-- File sinh tự động bởi scripts/gen-seed.mjs. KHÔNG sửa tay: sửa pois.sample.json rồi chạy lại.',
  '-- Chạy được nhiều lần. Điểm: cập nhật bán kính, ưu tiên, thứ tự; chỉ ghi tọa độ khi file có tọa độ (không xóa tọa độ đã đo trong CSDL). Bản dịch: chỉ thêm nếu chưa có.',
  '',
];

for (const p of data.pois) {
  lines.push(
    'insert into public.poi (id, tour_order, lat, lng, radius_m, priority, is_active)',
    `values (${str(p.id)}, ${num(p.tour_order)}, ${num(p.lat)}, ${num(p.lng)}, ${num(p.radius_m)}, ${num(p.priority)}, ${p.is_active !== false})`,
    'on conflict (id) do update set',
    '  tour_order = excluded.tour_order,',
    '  lat = coalesce(excluded.lat, public.poi.lat), lng = coalesce(excluded.lng, public.poi.lng),',
    '  radius_m = excluded.radius_m, priority = excluded.priority;',
    ''
  );
}

for (const p of data.pois) {
  for (const lang of ['vi', 'en']) {
    if (!p.name?.[lang]) continue;
    lines.push(
      'insert into public.poi_translation (poi_id, lang, name, tts_script, status, source)',
      `values (${str(p.id)}, '${lang}', ${str(p.name[lang])}, ${str(p.tts?.[lang])}, 'approved', 'human')`,
      'on conflict (poi_id, lang) do nothing;',
      ''
    );
  }
}

writeFileSync(join(root, 'supabase/seed.sql'), lines.join('\n'), 'utf8');
console.log(`Đã ghi supabase/seed.sql (${data.pois.length} điểm)`);
