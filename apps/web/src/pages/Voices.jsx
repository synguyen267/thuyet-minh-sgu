import { useEffect, useState } from 'react';
import { LANGS, getVoices, voicesFor, speak, stopSpeaking, unlockSpeech, getSavedVoice, saveVoice, speechSupported } from '../speech.js';

export default function Voices() {
  const [voices, setVoices] = useState(() => getVoices());
  const [chosen, setChosen] = useState(() => Object.fromEntries(LANGS.map((l) => [l.code, getSavedVoice(l.code)])));
  const [playing, setPlaying] = useState('');

  useEffect(() => {
    if (!speechSupported()) return undefined;
    const update = () => setVoices(getVoices());
    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', update);
      stopSpeaking();
    };
  }, []);

  function test(l) {
    unlockSpeech();
    setPlaying(l.code);
    speak(l.greeting, { code: l.code, voiceURI: chosen[l.code], onend: () => setPlaying(''), onerror: () => setPlaying('') });
  }

  function choose(code, uri) {
    saveVoice(code, uri);
    setChosen((c) => ({ ...c, [code]: uri }));
  }

  if (!speechSupported()) {
    return (
      <div className="page">
        <h2>Giọng đọc</h2>
        <p className="note warn">Trình duyệt này không hỗ trợ đọc văn bản. Hãy thử Chrome trên Android hoặc Safari trên iPhone.</p>
      </div>
    );
  }

  const ok = LANGS.filter((l) => voicesFor(l.code, voices).length > 0).length;

  return (
    <div className="page">
      <h2>Giọng đọc 5 ngôn ngữ</h2>
      <p className="lead">Thử trên cả Android và iPhone. Ngôn ngữ nào báo “chưa có giọng” thì cần dùng file audio tạo sẵn cho ngôn ngữ đó. Hiện có giọng: {ok}/{LANGS.length}.</p>
      <ul className="voice-list">
        {LANGS.map((l) => {
          const vs = voicesFor(l.code, voices);
          return (
            <li key={l.code} className="voice">
              <div className="voice-head">
                <strong>{l.label}</strong>
                <span className={vs.length ? 'tag ok' : 'tag bad'}>{vs.length ? `${vs.length} giọng` : 'Chưa có giọng'}</span>
              </div>
              <p className="sample">{l.greeting}</p>
              {vs.length > 0 && (
                <select value={chosen[l.code]} onChange={(e) => choose(l.code, e.target.value)} aria-label={`Chọn giọng ${l.label}`}>
                  <option value="">Giọng mặc định</option>
                  {vs.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
                </select>
              )}
              <button className="btn" onClick={() => test(l)} disabled={playing === l.code}>
                {playing === l.code ? 'Đang đọc…' : 'Đọc thử'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
