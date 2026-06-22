import { useCallback, useEffect, useRef, useState } from 'react';
import type { WsProximityState, WsServerEvent, WsVanPosition } from '@family-ice/shared';
import { WS_URL } from '../config';

export interface RealtimeState {
  connected: boolean;
  van: WsVanPosition | null;
  proximity: WsProximityState | null;
}

/**
 * Maintains the WebSocket to the backend: receives live van positions + per-user proximity
 * events, and exposes a sender for the device's own location (FR-002/FR-013).
 */
export function useRealtime(token: string | null) {
  const [state, setState] = useState<RealtimeState>({ connected: false, van: null, proximity: null });
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) return;
    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => setState((s) => ({ ...s, connected: true }));
    ws.onclose = () => setState((s) => ({ ...s, connected: false }));
    ws.onmessage = (ev) => {
      let parsed: WsServerEvent;
      try {
        parsed = JSON.parse(ev.data as string) as WsServerEvent;
      } catch {
        return;
      }
      if (parsed.type === 'van.position') setState((s) => ({ ...s, van: parsed }));
      else if (parsed.type === 'proximity.state') setState((s) => ({ ...s, proximity: parsed }));
    };

    return () => ws.close();
  }, [token]);

  const sendUserLocation = useCallback((lat: number, lng: number) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'user.location', lat, lng }));
    }
  }, []);

  return { state, sendUserLocation };
}
