import type { FastifyInstance } from 'fastify';
import { WsClientEvent } from '@family-ice/shared';
import type { ServerContext } from './server.js';
import { tokenFromRequest } from './auth.js';

/**
 * WebSocket endpoint (FR-001/FR-002): live van positions + per-user proximity events out;
 * user location in. Authenticated via the stub session token on the query string.
 */
export function registerWsRoutes(app: FastifyInstance, ctx: ServerContext): void {
  app.get('/ws', { websocket: true }, (socket, req) => {
    const session = ctx.sessions.resolve(tokenFromRequest(req.headers as Record<string, unknown>, req.query));
    if (!session) {
      socket.close(1008, 'unauthorized');
      return;
    }

    ctx.hub.add(session.userId, session.role, socket);

    // Replay current on-duty van positions so the map is correct immediately on connect.
    void ctx.ports.geo.listOnDutyVans().then((vans) => {
      for (const van of vans) {
        if (!van.lastPosition) continue;
        socket.send(
          JSON.stringify({
            type: 'van.position',
            vanId: van.id,
            lat: van.lastPosition.lat,
            lng: van.lastPosition.lng,
            headingDeg: van.lastPosition.headingDeg,
            stale: van.lastPosition.stale,
            at: van.lastPosition.at,
          }),
        );
      }
    });

    socket.on('message', (raw: Buffer) => {
      let json: unknown;
      try {
        json = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const parsed = WsClientEvent.safeParse(json);
      if (!parsed.success) return;
      const ev = parsed.data;
      if (ev.type === 'user.location') {
        // Transient — overwrites, never historized (FR-013 privacy).
        void ctx.ports.geo.setUserLocation(session.userId, { lat: ev.lat, lng: ev.lng });
      } else if (ev.type === 'van.location' && session.role === 'driver') {
        // The driver app IS the van (FR-009): treat its location as a van position,
        // through the same path as MQTT ingest (record + proximity).
        const ping = {
          vanId: ev.vanId,
          lat: ev.lat,
          lng: ev.lng,
          headingDeg: ev.headingDeg,
          speedMps: ev.speedMps,
          reportedAt: new Date().toISOString(),
        };
        void ctx.ports.geo.recordVanPosition(ping).then((accepted) => {
          if (accepted) return ctx.engine.onVanPing(ping);
        });
      }
    });

    socket.on('close', () => ctx.hub.remove(session.userId, socket));
  });
}
