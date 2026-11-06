import { useEffect, useState } from 'react';
import { getVoices, speechSupported } from '../speech.js';

/** Danh sách giọng đọc của thiết bị (trình duyệt nạp muộn nên phải lắng nghe voiceschanged). */
export function useVoices() {
  const [voices, setVoices] = useState(() => getVoices());
  useEffect(() => {
    if (!speechSupported()) return undefined;
    const update = () => setVoices(getVoices());
    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);
  return voices;
}
