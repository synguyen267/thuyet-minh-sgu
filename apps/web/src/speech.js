// Bọc Web Speech API (TTS). Chỉ chạy trên trình duyệt.
export const LANGS = [
  { code: 'vi', tag: 'vi-VN', label: 'Tiếng Việt', greeting: 'Chào mừng bạn đến với Trường Đại học Sài Gòn.' },
  { code: 'en', tag: 'en-US', label: 'English', greeting: 'Welcome to Saigon University.' },
  { code: 'zh', tag: 'zh-CN', label: '中文', greeting: '欢迎来到西贡大学。' },
  { code: 'ja', tag: 'ja-JP', label: '日本語', greeting: 'サイゴン大学へようこそ。' },
  { code: 'ko', tag: 'ko-KR', label: '한국어', greeting: '사이공대학교에 오신 것을 환영합니다.' },
];

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function getVoices() {
  return speechSupported() ? window.speechSynthesis.getVoices() : [];
}

export function voicesFor(code, voices = getVoices()) {
  return voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(code));
}

const voiceKey = (code) => `tm.voice.${code}`;
export function getSavedVoice(code) {
  try { return localStorage.getItem(voiceKey(code)) || ''; } catch { return ''; }
}
export function saveVoice(code, uri) {
  try { localStorage.setItem(voiceKey(code), uri); } catch { /* bỏ qua */ }
}

/** Đọc một đoạn văn. Hủy câu đang đọc trước để không chồng giọng. */
export function speak(text, { code = 'vi', voiceURI = '', onend, onerror } = {}) {
  if (!speechSupported()) { onerror?.(new Error('Trình duyệt không hỗ trợ đọc văn bản')); return; }
  const synth = window.speechSynthesis;
  const lang = LANGS.find((l) => l.code === code) ?? LANGS[0];
  const go = () => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang.tag;
    const voice = voiceURI ? getVoices().find((v) => v.voiceURI === voiceURI) : null;
    if (voice) u.voice = voice;
    u.onend = () => onend?.();
    u.onerror = (e) => { if (e.error !== 'canceled' && e.error !== 'interrupted') onerror?.(e); };
    synth.speak(u);
  };
  // Chrome (nhất là Android) hay bỏ qua câu mới nếu speak() ngay sau cancel(): chờ một nhịp ngắn.
  if (synth.speaking || synth.pending) {
    synth.cancel();
    setTimeout(go, 120);
  } else {
    go();
  }
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel();
}

/** Trình duyệt chỉ cho phát âm thanh sau thao tác chạm: gọi hàm này trong sự kiện bấm nút. */
export function unlockSpeech() {
  if (!speechSupported()) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  window.speechSynthesis.speak(u);
}
