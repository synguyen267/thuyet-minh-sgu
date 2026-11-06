// Xử lý nội dung đa ngôn ngữ: thuần, dùng chung cho web và mobile.
export const LANG_CODES = ['vi', 'en', 'zh', 'ja', 'ko'];

/** Tên hiển thị của điểm: ngôn ngữ chọn, rồi English, rồi tiếng Việt, cuối cùng là id. */
export function poiName(poi, lang = 'vi') {
  for (const l of [lang, 'en', 'vi']) {
    const n = poi?.name?.[l];
    if (n) return n;
  }
  return poi?.id ?? '';
}

/**
 * Chọn nội dung thuyết minh: ngôn ngữ chọn, thiếu thì English, rồi tiếng Việt.
 * Trả về { lang, text, audioUrl } hoặc null nếu điểm chưa có nội dung nào.
 */
export function pickNarration(poi, lang = 'vi') {
  for (const l of [lang, 'en', 'vi']) {
    const text = (poi?.tts?.[l] ?? '').trim();
    const audioUrl = poi?.audio?.[l] || null;
    if (text || audioUrl) return { lang: l, text, audioUrl };
  }
  return null;
}

/** Biến một dòng poi (kèm poi_translation lồng bên trong) từ Supabase thành đối tượng điểm của app. */
export function shapePoiRow(row) {
  const name = {}, tts = {}, audio = {}, status = {}, description = {};
  for (const t of row.poi_translation ?? []) {
    name[t.lang] = t.name;
    tts[t.lang] = t.tts_script ?? '';
    audio[t.lang] = t.audio_url ?? null;
    status[t.lang] = t.status;
    description[t.lang] = t.description ?? '';
  }
  // eslint-disable-next-line no-unused-vars
  const { poi_translation, ...rest } = row;
  return { ...rest, name, tts, audio, status, description };
}
