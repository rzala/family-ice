import Redis from 'ioredis';
import { config } from './config.js';
import type { Ports } from './ports/index.js';
import { PgDb } from './adapters/local/db.js';
import { PostgisGeoStore } from './adapters/local/geostore.js';
import { MqttMessageBus } from './adapters/local/messagebus.js';
import { ExpoPushService } from './adapters/local/push.js';
import { WsHub } from './realtime/hub.js';
import { SessionStore } from './api/auth.js';
import { buildServer } from './api/server.js';
import { ProximityEngine } from './proximity/engine.js';
import { startIngest } from './ingest/index.js';

/**
 * Composition root (Constitution Principle I): the ONLY place that chooses concrete adapters.
 * Everything else depends on the port interfaces. Adapter choice is by env; only 'local' is
 * implemented in the POC — other values fail fast with a clear message.
 */
function assertLocal(name: string, value: string): void {
  if (value !== 'local') {
    throw new Error(
      `Adapter '${name}=${value}' is not implemented in the POC. ` +
        `Implement packages/backend/src/adapters/${value}/ and wire it here (see infra/cloud-mapping.md).`,
    );
  }
}

async function main(): Promise<void> {
  assertLocal('MESSAGE_BUS', config.adapters.messageBus);
  assertLocal('GEO_STORE', config.adapters.geoStore);
  assertLocal('PUSH_SERVICE', config.adapters.pushService);
  assertLocal('DB', config.adapters.db);

  // ── Wire local adapters ────────────────────────────────────────────────────
  const db = await PgDb.init(config.databaseUrl);
  const redis = new Redis(config.redisUrl);
  const geo = new PostgisGeoStore(db.rawPool, redis, config.staleAfterMs);
  const bus = await MqttMessageBus.connect(config.mqttUrl);
  const push = new ExpoPushService();
  const ports: Ports = { db, geo, push, bus };

  const hub = new WsHub();
  const sessions = new SessionStore();

  // ── Domain wiring ──────────────────────────────────────────────────────────
  const engine = new ProximityEngine(geo, hub, config.proximity);
  await startIngest(bus, geo, engine);

  // ── HTTP + WS ────────────────────────────────────────────────────────────
  const app = await buildServer({ ports, hub, sessions, engine });
  await app.listen({ host: '0.0.0.0', port: config.port });
  app.log.info(`Family Ice backend listening on :${config.port}`);

  const shutdown = async () => {
    await app.close();
    await bus.close();
    await redis.quit();
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
