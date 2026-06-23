import { z } from 'zod';
import { LatLng, ProximityState } from './types.js';

/**
 * Contract definitions shared by producers (driver app / simulator), the backend, and the
 * mobile consumer. This file is the single source of truth for cross-boundary payloads
 * (Constitution Principle II). Validate at every boundary with these schemas.
 */

// ── Van telemetry (MQTT: van/{vanId}/loc) ───────────────────────────────────
export const VanPing = LatLng.extend({
  vanId: z.string(),
  headingDeg: z.number().min(0).max(360).nullable().default(null),
  speedMps: z.number().min(0).nullable().default(null),
  reportedAt: z.string().datetime(),
});
export type VanPing = z.infer<typeof VanPing>;

export const VanStatusMsg = z.object({
  vanId: z.string(),
  status: z.enum(['off_duty', 'on_duty']),
  at: z.string().datetime(),
});
export type VanStatusMsg = z.infer<typeof VanStatusMsg>;

// ── WebSocket: server → client ───────────────────────────────────────────────
export const WsVanPosition = z.object({
  type: z.literal('van.position'),
  vanId: z.string(),
  lat: z.number(),
  lng: z.number(),
  headingDeg: z.number().nullable(),
  stale: z.boolean(),
  at: z.string(),
});
export type WsVanPosition = z.infer<typeof WsVanPosition>;

export const WsProximityState = z.object({
  type: z.literal('proximity.state'),
  vanId: z.string(),
  state: ProximityState,
  distanceM: z.number(),
  etaSeconds: z.number().nullable().default(null),
});
export type WsProximityState = z.infer<typeof WsProximityState>;

export const WsHandRaiseUpdate = z.object({
  type: z.literal('handraise.update'),
  vanId: z.string(),
  clusters: z.array(
    z.object({
      lat: z.number(),
      lng: z.number(),
      count: z.number().int().positive(),
      handRaiseIds: z.array(z.string()),
    }),
  ),
});
export type WsHandRaiseUpdate = z.infer<typeof WsHandRaiseUpdate>;

export const WsStopConfirmed = z.object({
  type: z.literal('stop.confirmed'),
  vanId: z.string(),
  lat: z.number(),
  lng: z.number(),
  etaSeconds: z.number().nullable().default(null),
});
export type WsStopConfirmed = z.infer<typeof WsStopConfirmed>;

export const WsServerEvent = z.discriminatedUnion('type', [
  WsVanPosition,
  WsProximityState,
  WsHandRaiseUpdate,
  WsStopConfirmed,
]);
export type WsServerEvent = z.infer<typeof WsServerEvent>;

// ── WebSocket: client → server ───────────────────────────────────────────────
export const WsUserLocation = z.object({
  type: z.literal('user.location'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type WsUserLocation = z.infer<typeof WsUserLocation>;

/** Driver → server: the driver app reporting the van's position (FR-009). Driver role only. */
export const WsVanLocation = z.object({
  type: z.literal('van.location'),
  vanId: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  headingDeg: z.number().min(0).max(360).nullable().default(null),
  speedMps: z.number().min(0).nullable().default(null),
});
export type WsVanLocation = z.infer<typeof WsVanLocation>;

export const WsClientEvent = z.discriminatedUnion('type', [WsUserLocation, WsVanLocation]);
export type WsClientEvent = z.infer<typeof WsClientEvent>;

// ── Push notification data payloads (PushService) ────────────────────────────
export const ProximityPushData = z.object({
  kind: z.literal('proximity'),
  state: z.enum(['approaching', 'arriving', 'here']),
  vanId: z.string(),
  etaSeconds: z.number().optional(),
});
export type ProximityPushData = z.infer<typeof ProximityPushData>;

export const StopPushData = z.object({
  kind: z.literal('stop'),
  vanId: z.string(),
  lat: z.number(),
  lng: z.number(),
});
export type StopPushData = z.infer<typeof StopPushData>;
