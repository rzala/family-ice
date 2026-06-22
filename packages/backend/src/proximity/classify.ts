import type { LatLng, ProximityState } from '@family-ice/shared';
import { angularDiff, bearingDeg, haversineMeters } from './geo.js';

export interface ProximityConfig {
  approachingMaxM: number;
  arrivingMaxM: number;
  hereMaxM: number;
  headingToleranceDeg: number;
}

export interface Classification {
  state: ProximityState;
  distanceM: number;
  etaSeconds: number | null;
}

/** Fallback travel speed (m/s ≈ 30 km/h) when a ping carries no speed. */
const ASSUMED_SPEED_MPS = 8.3;

/**
 * Classify a van's proximity to a user into one of the three ordered states
 * (Constitution Principle IV). `approaching` additionally requires the van to be heading
 * TOWARD the user — distance alone is not enough (FR-003, spec Edge Cases). Pure function:
 * no IO, fully unit-testable.
 */
export function classify(
  van: LatLng,
  vanHeadingDeg: number | null,
  vanSpeedMps: number | null,
  user: LatLng,
  cfg: ProximityConfig,
): Classification {
  const distanceM = haversineMeters(van, user);

  if (distanceM <= cfg.hereMaxM) return { state: 'here', distanceM, etaSeconds: 0 };
  if (distanceM <= cfg.arrivingMaxM) return { state: 'arriving', distanceM, etaSeconds: eta(distanceM, vanSpeedMps) };

  if (distanceM <= cfg.approachingMaxM && isHeadingToward(van, vanHeadingDeg, user, cfg.headingToleranceDeg)) {
    return { state: 'approaching', distanceM, etaSeconds: eta(distanceM, vanSpeedMps) };
  }
  return { state: 'none', distanceM, etaSeconds: null };
}

/** True if the van's direction of travel points within tolerance of the user. */
export function isHeadingToward(
  van: LatLng,
  vanHeadingDeg: number | null,
  user: LatLng,
  toleranceDeg: number,
): boolean {
  // Unknown heading ⇒ cannot filter; treat as inbound so we don't suppress a real approach.
  if (vanHeadingDeg == null) return true;
  return angularDiff(vanHeadingDeg, bearingDeg(van, user)) <= toleranceDeg;
}

function eta(distanceM: number, speedMps: number | null): number {
  const speed = speedMps && speedMps > 0.5 ? speedMps : ASSUMED_SPEED_MPS;
  return Math.round(distanceM / speed);
}
