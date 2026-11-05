import { useEffect, useState } from 'react';

/**
 * Theo dõi GPS. status: idle | asking | ok | denied | unsupported | error
 * pos: { lat, lng, accuracy, ts }
 */
export function useGeolocation(enabled) {
  const [state, setState] = useState({ status: 'idle', pos: null, error: null });

  useEffect(() => {
    if (!enabled) return undefined;
    if (!('geolocation' in navigator)) {
      setState({ status: 'unsupported', pos: null, error: null });
      return undefined;
    }
    setState((s) => ({ ...s, status: 'asking' }));
    const id = navigator.geolocation.watchPosition(
      (p) =>
        setState({
          status: 'ok',
          pos: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, ts: p.timestamp },
          error: null,
        }),
      (e) => setState((s) => ({ ...s, status: e.code === 1 ? 'denied' : 'error', error: e.message })),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return state;
}
