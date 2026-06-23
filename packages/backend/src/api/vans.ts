import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ServerContext } from './server.js';
import { tokenFromRequest } from './auth.js';

const DutyBody = z.object({ status: z.enum(['on_duty', 'off_duty']) });

/** Van lookups + driver duty control (FR-001, FR-009, FR-014). */
export function registerVanRoutes(app: FastifyInstance, ctx: ServerContext): void {
  app.get('/vans', async () => {
    return ctx.ports.geo.listOnDutyVans();
  });

  app.get('/vans/:vanId', async (req, reply) => {
    const { vanId } = req.params as { vanId: string };
    const van = await ctx.ports.geo.getVan(vanId);
    if (!van) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'van not found' } });
    return van;
  });

  // Driver goes on/off duty (FR-009) and the status is broadcast over the message bus.
  app.post('/vans/:vanId/duty', async (req, reply) => {
    const session = ctx.sessions.resolve(tokenFromRequest(req.headers as Record<string, unknown>, req.query));
    if (!session || session.role !== 'driver') {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'driver role required' } });
    }
    const { vanId } = req.params as { vanId: string };
    const body = DutyBody.parse(req.body ?? {});
    await ctx.ports.db.setVanDuty(vanId, body.status);
    void ctx.ports.bus.publish(`van/${vanId}/status`, {
      vanId,
      status: body.status,
      at: new Date().toISOString(),
    });
    return reply.send({ vanId, status: body.status });
  });
}
