-- File sinh tự động bởi scripts/gen-seed.mjs. KHÔNG sửa tay: sửa pois.sample.json rồi chạy lại.
-- Chạy được nhiều lần. Điểm: cập nhật bán kính, ưu tiên, thứ tự; chỉ ghi tọa độ khi file có tọa độ (không xóa tọa độ đã đo trong CSDL). Bản dịch: chỉ thêm nếu chưa có.

insert into public.poi (id, tour_order, lat, lng, radius_m, priority, is_active)
values ('cong-chinh', 1, null, null, 15, 2, true)
on conflict (id) do update set
  tour_order = excluded.tour_order,
  lat = coalesce(excluded.lat, public.poi.lat), lng = coalesce(excluded.lng, public.poi.lng),
  radius_m = excluded.radius_m, priority = excluded.priority;

insert into public.poi (id, tour_order, lat, lng, radius_m, priority, is_active)
values ('khu-hb', 2, null, null, 15, 1, true)
on conflict (id) do update set
  tour_order = excluded.tour_order,
  lat = coalesce(excluded.lat, public.poi.lat), lng = coalesce(excluded.lng, public.poi.lng),
  radius_m = excluded.radius_m, priority = excluded.priority;

insert into public.poi (id, tour_order, lat, lng, radius_m, priority, is_active)
values ('khu-d', 3, null, null, 20, 1, true)
on conflict (id) do update set
  tour_order = excluded.tour_order,
  lat = coalesce(excluded.lat, public.poi.lat), lng = coalesce(excluded.lng, public.poi.lng),
  radius_m = excluded.radius_m, priority = excluded.priority;

insert into public.poi (id, tour_order, lat, lng, radius_m, priority, is_active)
values ('khu-c', 4, null, null, 25, 1, true)
on conflict (id) do update set
  tour_order = excluded.tour_order,
  lat = coalesce(excluded.lat, public.poi.lat), lng = coalesce(excluded.lng, public.poi.lng),
  radius_m = excluded.radius_m, priority = excluded.priority;

insert into public.poi (id, tour_order, lat, lng, radius_m, priority, is_active)
values ('can-tin', 5, null, null, 20, 1, true)
on conflict (id) do update set
  tour_order = excluded.tour_order,
  lat = coalesce(excluded.lat, public.poi.lat), lng = coalesce(excluded.lng, public.poi.lng),
  radius_m = excluded.radius_m, priority = excluded.priority;

insert into public.poi (id, tour_order, lat, lng, radius_m, priority, is_active)
values ('khu-b', 6, null, null, 25, 1, true)
on conflict (id) do update set
  tour_order = excluded.tour_order,
  lat = coalesce(excluded.lat, public.poi.lat), lng = coalesce(excluded.lng, public.poi.lng),
  radius_m = excluded.radius_m, priority = excluded.priority;

insert into public.poi (id, tour_order, lat, lng, radius_m, priority, is_active)
values ('khu-a', 7, null, null, 30, 1, true)
on conflict (id) do update set
  tour_order = excluded.tour_order,
  lat = coalesce(excluded.lat, public.poi.lat), lng = coalesce(excluded.lng, public.poi.lng),
  radius_m = excluded.radius_m, priority = excluded.priority;

insert into public.poi (id, tour_order, lat, lng, radius_m, priority, is_active)
values ('cong-sau', 8, null, null, 15, 2, true)
on conflict (id) do update set
  tour_order = excluded.tour_order,
  lat = coalesce(excluded.lat, public.poi.lat), lng = coalesce(excluded.lng, public.poi.lng),
  radius_m = excluded.radius_m, priority = excluded.priority;

insert into public.poi (id, tour_order, lat, lng, radius_m, priority, is_active)
values ('khu-e', 9, null, null, 15, 1, true)
on conflict (id) do update set
  tour_order = excluded.tour_order,
  lat = coalesce(excluded.lat, public.poi.lat), lng = coalesce(excluded.lng, public.poi.lng),
  radius_m = excluded.radius_m, priority = excluded.priority;

insert into public.poi (id, tour_order, lat, lng, radius_m, priority, is_active)
values ('san-bong', 10, null, null, 30, 1, true)
on conflict (id) do update set
  tour_order = excluded.tour_order,
  lat = coalesce(excluded.lat, public.poi.lat), lng = coalesce(excluded.lng, public.poi.lng),
  radius_m = excluded.radius_m, priority = excluded.priority;

insert into public.poi_translation (poi_id, lang, name, tts_script, status, source)
values ('cong-chinh', 'vi', 'Cổng chính (273 An Dương Vương)', 'Bạn đang ở Cổng chính (273 An Dương Vương), một địa điểm trong Trường Đại học Sài Gòn. Nội dung giới thiệu chi tiết sẽ được bổ sung.', 'approved', 'human')
on conflict (poi_id, lang) do nothing;

insert into public.poi_translation (poi_id, lang, name, tts_script, status, source)
values ('cong-chinh', 'en', 'Main Gate (273 An Duong Vuong)', 'You are at Main Gate (273 An Duong Vuong), a location at Saigon University. Detailed narration will be added later.', 'approved', 'human')
on conflict (poi_id, lang) do nothing;

insert into public.poi_translation (poi_id, lang, name, tts_script, status, source)
values ('khu-hb', 'vi', 'Khu HB (Hiệu Bộ)', 'Bạn đang ở Khu HB (Hiệu Bộ), một địa điểm trong Trường Đại học Sài Gòn. Nội dung giới thiệu chi tiết sẽ được bổ sung.', 'approved', 'human')
on conflict (poi_id, lang) do nothing;

insert into public.poi_translation (poi_id, lang, name, tts_script, status, source)
values ('khu-hb', 'en', 'HB Building (Administration)', 'You are at HB Building (Administration), a location at Saigon University. Detailed narration will be added later.', 'approved', 'human')
on conflict (poi_id, lang) do nothing;

insert into public.poi_translation (poi_id, lang, name, tts_script, status, source)
values ('khu-d', 'vi', 'Khu D', 'Bạn đang ở Khu D, một địa điểm trong Trường Đại học Sài Gòn. Nội dung giới thiệu chi tiết sẽ được bổ sung.', 'approved', 'human')
on conflict (poi_id, lang) do nothing;

insert into public.poi_translation (poi_id, lang, name, tts_script, status, source)
values ('khu-d', 'en', 'Building D', 'You are at Building D, a location at Saigon University. Detailed narration will be added later.', 'approved', 'human')
on conflict (poi_id, lang) do nothing;

insert into public.poi_translation (poi_id, lang, name, tts_script, status, source)
values ('khu-c', 'vi', 'Khu C', 'Bạn đang ở Khu C, một địa điểm trong Trường Đại học Sài Gòn. Nội dung giới thiệu chi tiết sẽ được bổ sung.', 'approved', 'human')
on conflict (poi_id, lang) do nothing;

insert into public.poi_translation (poi_id, lang, name, tts_script, status, source)
values ('khu-c', 'en', 'Building C', 'You are at Building C, a location at Saigon University. Detailed narration will be added later.', 'approved', 'human')
on conflict (poi_id, lang) do nothing;

insert into public.poi_translation (poi_id, lang, name, tts_script, status, source)
values ('can-tin', 'vi', 'Căn tin', 'Bạn đang ở Căn tin, một địa điểm trong Trường Đại học Sài Gòn. Nội dung giới thiệu chi tiết sẽ được bổ sung.', 'approved', 'human')
on conflict (poi_id, lang) do nothing;

insert into public.poi_translation (poi_id, lang, name, tts_script, status, source)
values ('can-tin', 'en', 'Canteen', 'You are at Canteen, a location at Saigon University. Detailed narration will be added later.', 'approved', 'human')
on conflict (poi_id, lang) do nothing;

insert into public.poi_translation (poi_id, lang, name, tts_script, status, source)
values ('khu-b', 'vi', 'Khu B', 'Bạn đang ở Khu B, một địa điểm trong Trường Đại học Sài Gòn. Nội dung giới thiệu chi tiết sẽ được bổ sung.', 'approved', 'human')
on conflict (poi_id, lang) do nothing;

insert into public.poi_translation (poi_id, lang, name, tts_script, status, source)
values ('khu-b', 'en', 'Building B', 'You are at Building B, a location at Saigon University. Detailed narration will be added later.', 'approved', 'human')
on conflict (poi_id, lang) do nothing;

insert into public.poi_translation (poi_id, lang, name, tts_script, status, source)
values ('khu-a', 'vi', 'Khu A', 'Bạn đang ở Khu A, một địa điểm trong Trường Đại học Sài Gòn. Nội dung giới thiệu chi tiết sẽ được bổ sung.', 'approved', 'human')
on conflict (poi_id, lang) do nothing;

insert into public.poi_translation (poi_id, lang, name, tts_script, status, source)
values ('khu-a', 'en', 'Building A', 'You are at Building A, a location at Saigon University. Detailed narration will be added later.', 'approved', 'human')
on conflict (poi_id, lang) do nothing;

insert into public.poi_translation (poi_id, lang, name, tts_script, status, source)
values ('cong-sau', 'vi', 'Cổng sau (số 6 Nguyễn Trãi)', 'Bạn đang ở Cổng sau (số 6 Nguyễn Trãi), một địa điểm trong Trường Đại học Sài Gòn. Nội dung giới thiệu chi tiết sẽ được bổ sung.', 'approved', 'human')
on conflict (poi_id, lang) do nothing;

insert into public.poi_translation (poi_id, lang, name, tts_script, status, source)
values ('cong-sau', 'en', 'Back Gate (6 Nguyen Trai Street)', 'You are at Back Gate (6 Nguyen Trai Street), a location at Saigon University. Detailed narration will be added later.', 'approved', 'human')
on conflict (poi_id, lang) do nothing;

insert into public.poi_translation (poi_id, lang, name, tts_script, status, source)
values ('khu-e', 'vi', 'Khu E', 'Bạn đang ở Khu E, một địa điểm trong Trường Đại học Sài Gòn. Nội dung giới thiệu chi tiết sẽ được bổ sung.', 'approved', 'human')
on conflict (poi_id, lang) do nothing;

insert into public.poi_translation (poi_id, lang, name, tts_script, status, source)
values ('khu-e', 'en', 'Building E', 'You are at Building E, a location at Saigon University. Detailed narration will be added later.', 'approved', 'human')
on conflict (poi_id, lang) do nothing;

insert into public.poi_translation (poi_id, lang, name, tts_script, status, source)
values ('san-bong', 'vi', 'Sân bóng', 'Bạn đang ở Sân bóng, một địa điểm trong Trường Đại học Sài Gòn. Nội dung giới thiệu chi tiết sẽ được bổ sung.', 'approved', 'human')
on conflict (poi_id, lang) do nothing;

insert into public.poi_translation (poi_id, lang, name, tts_script, status, source)
values ('san-bong', 'en', 'Sports Fields', 'You are at Sports Fields, a location at Saigon University. Detailed narration will be added later.', 'approved', 'human')
on conflict (poi_id, lang) do nothing;
