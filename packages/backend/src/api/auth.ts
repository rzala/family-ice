import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Db } from '../ports/index.js';

/**
 * Stub authentication for the POC (Constitution: no production identity).
 * A session token maps to a user id + role. In-memory; resets on restart.
 */
export interface Session {
  token: string;
  userId: string;
  role: 'user' | 'driver';
}

export class SessionStore {
  private byToken = new Map<string, Session>();

  create(userId: string, role: 'user' | 'driver'): Session {
    const session: Session = { token: `sess_${randomUUID()}`, userId, role };
    this.byToken.set(session.token, session);
    return session;
  }

  resolve(token: string | undefined): Session | null {
    return token ? (this.byToken.get(token) ?? null) : null;
  }
}

const CreateSessionBody = z.object({
  displayName: z.string().min(1).default('Demo User'),
  role: z.enum(['user', 'driver']).default('user'),
});

export function registerAuthRoutes(app: FastifyInstance, db: Db, sessions: SessionStore): void {
  app.post('/auth/session', async (req, reply) => {
    const body = CreateSessionBody.parse(req.body ?? {});
    const user = await db.createSession(body.displayName, body.role);
    const session = sessions.create(user.id, user.role);
    return reply.send({ token: session.token, userId: user.id, role: user.role });
  });
}

/** Extract a bearer/query token from a request (used by REST + WS upgrade). */
export function tokenFromRequest(headers: Record<string, unknown>, query: unknown): string | undefined {
  const auth = headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7);
  const q = query as { token?: string } | undefined;
  return q?.token;
}
