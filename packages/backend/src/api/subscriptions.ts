import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ServerContext } from './server.js';
import { tokenFromRequest } from './auth.js';

const CreateSub = z.object({
  vanId: z.string(),
  radiusM: z.number().int().positive().max(10_000).default(3000),
});

/** Subscriptions (FR-006): a user opts in to a van's proximity alerts. */
export function registerSubscriptionRoutes(app: FastifyInstance, ctx: ServerContext): void {
  app.post('/subscriptions', async (req, reply) => {
    const session = ctx.sessions.resolve(tokenFromRequest(req.headers as Record<string, unknown>, req.query));
    if (!session) return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'no session' } });

    const body = CreateSub.parse(req.body ?? {});
    const sub = await ctx.ports.db.addSubscription(session.userId, body.vanId, body.radiusM);
    return reply.status(201).send(sub);
  });

  app.delete('/subscriptions/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await ctx.ports.db.removeSubscription(id);
    return reply.status(204).send();
  });
}
