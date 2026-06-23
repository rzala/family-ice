import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { config } from '../config.js';
import type { Ports } from '../ports/index.js';
import type { WsHub } from '../realtime/hub.js';
import { SessionStore, registerAuthRoutes } from './auth.js';
import { registerWsRoutes } from './ws.js';
import { registerVanRoutes } from './vans.js';
import { registerSubscriptionRoutes } from './subscriptions.js';
import { registerPushRoutes } from './push.js';

export interface ServerContext {
  ports: Ports;
  hub: WsHub;
  sessions: SessionStore;
}

/** Build the Fastify app: health, WebSocket, and feature routes. */
export async function buildServer(ctx: ServerContext): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  await app.register(websocket);

  // Lightweight CORS for the web origin(s) (no extra dependency). The native app
  // bypasses CORS entirely; this only matters if a browser client calls the API.
  if (config.corsOrigins.length > 0) {
    app.addHook('onRequest', async (req, reply) => {
      const origin = req.headers.origin;
      if (origin && config.corsOrigins.includes(origin)) {
        reply.header('access-control-allow-origin', origin);
        reply.header('vary', 'Origin');
        reply.header('access-control-allow-methods', 'GET,POST,DELETE,OPTIONS');
        reply.header('access-control-allow-headers', 'content-type,authorization');
      }
      if (req.method === 'OPTIONS') reply.status(204).send();
    });
  }

  // Friendly root so hitting the bare URL in a browser isn't a bare 404.
  app.get('/', async () => ({
    service: 'Family Ice API',
    status: 'ok',
    description: 'Real-time ice cream van proximity tracking',
    endpoints: ['/health', '/vans', '/auth/session', '/subscriptions', '/push/token', '/ws (WebSocket)'],
  }));

  app.get('/health', async () => ({ ok: true }));

  registerAuthRoutes(app, ctx.ports.db, ctx.sessions);
  registerWsRoutes(app, ctx);
  registerVanRoutes(app, ctx);
  registerSubscriptionRoutes(app, ctx);
  registerPushRoutes(app, ctx);

  // Uniform error shape.
  app.setErrorHandler((err, _req, reply) => {
    const status = err.statusCode ?? 400;
    reply.status(status).send({ error: { code: err.code ?? 'ERROR', message: err.message } });
  });

  return app;
}
