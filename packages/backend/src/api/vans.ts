import type { FastifyInstance } from 'fastify';
import type { ServerContext } from './server.js';

/** Van lookups (FR-001, FR-014: staleness is computed in the GeoStore). */
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
}
