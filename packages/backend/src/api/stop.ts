import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ServerContext } from './server.js';
import { tokenFromRequest } from './auth.js';
import { buildHandRaiseUpdate } from '../handraise/service.js';

const StopBody = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  handRaiseIds: z.array(z.string()).default([]),
});

/** Driver confirms a stop (FR-010): record it, acknowledge the raises, notify the waiting users. */
export function registerStopRoutes(app: FastifyInstance, ctx: ServerContext): void {
  app.post('/vans/:vanId/stop', async (req, reply) => {
    const session = ctx.sessions.resolve(tokenFromRequest(req.headers as Record<string, unknown>, req.query));
    if (!session || session.role !== 'driver') {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'driver role required' } });
    }
    const { vanId } = req.params as { vanId: string };
    const body = StopBody.parse(req.body ?? {});

    // Resolve which users to notify BEFORE acknowledging (they leave the pending set after).
    const pending = await ctx.ports.db.listPendingHandRaises(vanId);
    const targeted = body.handRaiseIds.length
      ? pending.filter((p) => body.handRaiseIds.includes(p.id))
      : pending;
    const handRaiseIds = targeted.map((p) => p.id);

    await ctx.ports.db.addStopConfirmation(vanId, body.lat, body.lng, handRaiseIds);
    await ctx.ports.db.acknowledgeHandRaises(handRaiseIds);

    // Notify each waiting user: live banner over WS + background push.
    const notified = new Set<string>();
    for (const p of targeted) {
      notified.add(p.userId);
      ctx.hub.toUser(p.userId, {
        type: 'stop.confirmed',
        vanId,
        lat: body.lat,
        lng: body.lng,
        etaSeconds: null,
      });
      if (p.pushToken) {
        void ctx.ports.push.send({
          token: p.pushToken,
          title: "We're stopping near you",
          body: 'The driver confirmed your stop — head out!',
          data: { kind: 'stop', vanId, lat: body.lat, lng: body.lng },
        });
      }
    }

    // Refresh drivers' inbox (the acknowledged raises drop off).
    ctx.hub.toDrivers(await buildHandRaiseUpdate(ctx.ports.db, vanId));
    return reply.status(201).send({ notifiedUsers: notified.size });
  });
}
