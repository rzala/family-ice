/**
 * Centralized configuration. Proximity thresholds and the staleness window are tunable
 * here (Constitution Principle IV — defaults, not contractual values).
 */
export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://familyice:familyice@localhost:5432/familyice',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  mqttUrl: process.env.MQTT_URL ?? 'mqtt://localhost:1883',

  // Adapter selection (Principle I). Only 'local' is implemented in the POC.
  adapters: {
    messageBus: process.env.MESSAGE_BUS ?? 'local',
    geoStore: process.env.GEO_STORE ?? 'local',
    pushService: process.env.PUSH_SERVICE ?? 'local',
    db: process.env.DB ?? 'local',
  },

  // Proximity tiers (metres) and ETA/staleness windows.
  proximity: {
    approachingMaxM: 3000,
    arrivingMaxM: 300,
    hereMaxM: 50,
    // Only treat a van as "approaching" if its bearing is within this cone of the user.
    headingToleranceDeg: 60,
    // A visit goes stale after this idle gap; the next approach opens a fresh visit and
    // re-notifies (prevents one fly-by from suppressing a genuine later approach).
    visitCooldownMs: 120_000,
  },
  staleAfterMs: Number(process.env.STALE_AFTER_MS ?? 8000),

  // Comma-separated allowed browser origins for CORS (the native app doesn't need it).
  // e.g. "https://familyice.prod.trafty.com". Empty ⇒ no cross-origin browser access.
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
} as const;

export type Config = typeof config;
