import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  WsHandRaiseUpdate,
  WsProximityState,
  WsServerEvent,
  WsStopConfirmed,
  WsVanPosition,
} from '@family-ice/shared';
import { WS_URL } from '../config';

export interface RealtimeState {
  connected: boolean;
  van: WsVanPosition | null;
  proximity: WsProximityState | null;
  handRaises: WsHandRaiseUpdate | null; // driver inbox (live)
  stop: WsStopConfirmed | null; // user: "we're stopping near you"
}

/**
 * WebSocket to the backend. Receives live van positions, per-user proximity, driver-facing
 * hand-raise clusters, and stop confirmations; sends the device's own location (user) or the
 * van's location (driver, FR-009).
 */
export function useRealtime(token: string | null) {
  const [state, setState] = useState<RealtimeState>({
    connected: false,
    van: null,
    proximity: null,
    handRaises: null,
    stop: null,
  });
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) return;
    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => setState((s) => ({ ...s, connected: true }));
    ws.onclose = () => setState((s) => ({ ...s, connected: false }));
    ws.onmessage = (ev) => {
      let m: WsServerEvent;
      try {
        m = JSON.parse(ev.data as string) as WsServerEvent;
      } catch {
        return;
      }
      switch (m.type) {
        case 'van.position':
          setState((s) => ({ ...s, van: m }));
          break;
        case 'proximity.state':
          setState((s) => ({ ...s, proximity: m }));
          break;
        case 'handraise.update':
          setState((s) => ({ ...s, handRaises: m }));
          break;
        case 'stop.confirmed':
          setState((s) => ({ ...s, stop: m }));
          break;
      }
    };

    return () => ws.close();
  }, [token]);

  const send = useCallback((payload: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
  }, []);

  const sendUserLocation = useCallback(
    (lat: number, lng: number) => send({ type: 'user.location', lat, lng }),
    [send],
  );
  const sendVanLocation = useCallback(
    (vanId: string, lat: number, lng: number, headingDeg: number | null = null) =>
      send({ type: 'van.location', vanId, lat, lng, headingDeg }),
    [send],
  );

  return { state, sendUserLocation, sendVanLocation };
}
