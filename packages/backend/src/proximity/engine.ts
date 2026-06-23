import type { VanPing } from '@family-ice/shared';
import type { GeoStore } from '../ports/index.js';
import type { Realtime } from '../realtime/hub.js';
import { classify, type ProximityConfig } from './classify.js';
import type { Notifier } from './notifier.js';

/**
 * Proximity engine (Constitution Principle IV).
 *
 * On each accepted van ping: broadcast the live position to all clients, then classify the
 * van's proximity to every subscribed nearby user and emit a `proximity.state` event.
 *
 * User Story 1 surfaces the current state to the foreground map (idempotent display — the
 * banner just reflects the latest state). User Story 2 adds the visit state-machine + the
 * de-duplicated push path on top of this same classification.
 */
export class ProximityEngine {
  constructor(
    private readonly geo: GeoStore,
    private readonly realtime: Realtime,
    private readonly cfg: ProximityConfig,
    private readonly notifier?: Notifier,
  ) {}

  async onVanPing(ping: VanPing): Promise<void> {
    // 1. Live position to every client (FR-001). Freshly reported ⇒ not stale.
    this.realtime.broadcastVanPosition({
      type: 'van.position',
      vanId: ping.vanId,
      lat: ping.lat,
      lng: ping.lng,
      headingDeg: ping.headingDeg,
      stale: false,
      at: ping.reportedAt,
    });

    // 2. Per-subscriber proximity (FR-002/FR-003). Coarse PostGIS pre-filter by outer radius,
    //    then exact classification (distance + heading) per candidate.
    const vanPoint = { lat: ping.lat, lng: ping.lng };
    const nearby = await this.geo.findSubscribedUsersNear(ping.vanId, vanPoint, this.cfg.approachingMaxM);

    for (const u of nearby) {
      const c = classify(vanPoint, ping.headingDeg, ping.speedMps, u.location, this.cfg);
      if (c.state === 'none') continue;
      // Foreground live banner (US1): emit current state every ping (idempotent display).
      this.realtime.toUser(u.userId, {
        type: 'proximity.state',
        vanId: ping.vanId,
        state: c.state,
        distanceM: Math.round(c.distanceM),
        etaSeconds: c.etaSeconds,
      });
      // Background push (US2): de-duplicated, at most one per state per visit.
      void this.notifier?.handle(u.userId, ping.vanId, u.pushToken, c);
    }
  }
}
