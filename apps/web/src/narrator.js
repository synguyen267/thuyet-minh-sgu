import { speak, stopSpeaking } from './speech.js';

let audioEl = null;

/** Phát một đoạn thuyết minh: file audio nếu có (lỗi thì đọc bằng TTS), không thì đọc bằng TTS. */
export function playNarration({ text, lang, audioUrl, voiceURI, onend, onerror }) {
  stopNarration();
  const viaSpeech = () => speak(text, { code: lang, voiceURI, onend, onerror });
  if (!audioUrl) return viaSpeech();

  const a = new Audio(audioUrl);
  audioEl = a;
  const fallback = () => {
    if (audioEl !== a) return;
    audioEl = null;
    if (text) viaSpeech();
    else onerror?.(new Error('Không phát được audio'));
  };
  a.onended = () => {
    if (audioEl !== a) return;
    audioEl = null;
    onend?.();
  };
  a.onerror = fallback;
  a.play().catch(fallback);
  return undefined;
}

export function stopNarration() {
  if (audioEl) {
    const a = audioEl;
    audioEl = null;
    a.pause();
    a.removeAttribute('src');
  }
  stopSpeaking();
}
