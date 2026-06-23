import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ServerContext } from './server.js';
import { tokenFromRequest } from './auth.js';
import { buildHandRaiseUpdate } from '../handraise/service.js';

const RaiseBody = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  note: z.string().max(280).nullable().default(null),
});

/** Hand-raise endpoints (FR-007, FR-008). */
export function registerHandRaiseRoutes(app: FastifyInstance, ctx: ServerContext): void {
  // User raises a hand → persist, then push the refreshed cluster snapshot to drivers.
  app.post('/vans/:vanId/handraise', async (req, reply) => {
    const session = ctx.sessions.resolve(tokenFromRequest(req.headers as Record<string, unknown>, req.query));
    if (!session) return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'no session' } });
    const { vanId } = req.params as { vanId: string };
    const body = RaiseBody.parse(req.body ?? {});

    const raise = await ctx.ports.db.addHandRaise(session.userId, vanId, body.lat, body.lng, body.note);
    ctx.hub.toDrivers(await buildHandRaiseUpdate(ctx.ports.db, vanId));
    return reply.status(201).send(raise);
  });

  // Driver pulls the current clustered pending raises.
  app.get('/vans/:vanId/handraises', async (req) => {
    const { vanId } = req.params as { vanId: string };
    return buildHandRaiseUpdate(ctx.ports.db, vanId);
  });
}
