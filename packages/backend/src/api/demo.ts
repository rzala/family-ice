import type { FastifyInstance } from 'fastify';
import type { ServerContext } from './server.js';

/**
 * Demo control: a single tap (re)starts the server-side drive of the Kert utca route toward
 * subscribers. Self-contained — no simulator or driver app needed for a demo.
 */
export function registerDemoRoutes(app: FastifyInstance, ctx: ServerContext): void {
  app.post('/vans/:vanId/demo', async (req, reply) => {
    const { vanId } = req.params as { vanId: string };
    void ctx.demo.start(vanId);
    return reply.status(202).send({ started: true, vanId });
  });
}
