import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ServerContext } from './server.js';
import { tokenFromRequest } from './auth.js';

const TokenBody = z.object({ pushToken: z.string().nullable() });

/**
 * Push token registration (FR-004). A null/absent token disables alerts for the user;
 * the live map still works. The actual push dispatch lands in User Story 2.
 */
export function registerPushRoutes(app: FastifyInstance, ctx: ServerContext): void {
  app.post('/push/token', async (req, reply) => {
    const session = ctx.sessions.resolve(tokenFromRequest(req.headers as Record<string, unknown>, req.query));
    if (!session) return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'no session' } });

    const body = TokenBody.parse(req.body ?? {});
    await ctx.ports.db.setPushToken(session.userId, body.pushToken);
    return reply.status(204).send();
  });
}
