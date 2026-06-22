import { z } from 'zod';

/** Roles supported by the single dual-role app (Constitution Principle II). */
export const Role = z.enum(['user', 'driver']);
export type Role = z.infer<typeof Role>;

export const VanStatus = z.enum(['off_duty', 'on_duty']);
export type VanStatus = z.infer<typeof VanStatus>;

/**
 * The three ordered proximity states (Constitution Principle IV).
 * `none` is the resting state before a van enters the user's outer radius.
 */
export const ProximityState = z.enum(['none', 'approaching', 'arriving', 'here']);
export type ProximityState = z.infer<typeof ProximityState>;

export const HandRaiseStatus = z.enum(['pending', 'acknowledged', 'expired']);
export type HandRaiseStatus = z.infer<typeof HandRaiseStatus>;

/** A WGS84 coordinate. */
export const LatLng = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof LatLng>;

export const Van = z.object({
  id: z.string(),
  name: z.string(),
  status: VanStatus,
  lastPosition: LatLng.extend({
    headingDeg: z.number().min(0).max(360).nullable(),
    stale: z.boolean(),
    at: z.string(),
  }).nullable(),
});
export type Van = z.infer<typeof Van>;
