import type { VanPing } from '@family-ice/shared';
import type { Db, GeoStore, PushService } from '../ports/index.js';
import type { ProximityEngine } from '../proximity/engine.js';
import type { Realtime } from '../realtime/hub.js';
import { haversineMeters, bearingDeg } from '../proximity/geo.js';
import { KERT_UTCA_ROUTE, type RoutePoint } from './route.js';

const DISPLAY_SPEED_MPS = 8.3; // realistic reported speed → ~5 min ETA when ~2.5 km out
const DURATION_S = 120; // ~2 min real wall-clock to traverse the route
const INTERVAL_MS = 1500;
const STOP_RADIUS_M = 60; // van halts when within this of a hand-raise on its route
const REVERSE_MAX_M = 500; // if it already passed a raise but is within this, it reverses

interface PendingStop {
  userId: string;
  lat: number;
  lng: number;
  at: number; // metres along the route of the point nearest the raise
}

/**
 * Server-side demo driver. Replays the Kert utca route (advancing fast, reporting a realistic
 * speed so the ETA reads ~5 min). It is hand-raise aware: when a customer raises a hand the van
 * does NOT detour — it stops on its route at the raise spot when it reaches it, and if it has
 * already passed the spot but is within 500 m it reverses back to it.
 */
export class DemoDriver {
  private timer: ReturnType<typeof setInterval> | null = null;
  private vanId = '';
  private route: RoutePoint[] = [];
  private cum: number[] = []; // cumulative distance to each route vertex
  private totalLen = 0;
  private traveled = 0; // metres along the route
  private dir: 1 | -1 = 1;
  private pending: PendingStop[] = [];

  constructor(
    private readonly geo: GeoStore,
    private readonly engine: ProximityEngine,
    private readonly db: Db,
    private readonly realtime: Realtime,
    private readonly push: PushService,
  ) {}

  async start(vanId: string): Promise<void> {
    this.stop();
    await this.db.closeOpenVisitsForVan(vanId);

    this.vanId = vanId;
    this.route = KERT_UTCA_ROUTE;
    this.cum = [0];
    for (let i = 1; i < this.route.length; i++) {
      this.cum[i] = this.cum[i - 1] + haversineMeters(this.route[i - 1], this.route[i]);
    }
    this.totalLen = this.cum[this.cum.length - 1];
    this.traveled = 0;
    this.dir = 1;
    this.pending = [];

    const stepM = (this.totalLen / DURATION_S) * (INTERVAL_MS / 1000);
    this.timer = setInterval(() => void this.tick(stepM), INTERVAL_MS);
  }

  /** A customer raised a hand: the driver becomes aware and will stop at the spot on route. */
  noteHandRaise(vanId: string, userId: string, lat: number, lng: number): void {
    if (this.timer === null || vanId !== this.vanId) return; // only while this van is driving
    const at = this.nearestAlong(lat, lng);
    this.pending.push({ userId, lat, lng, at });
    // If we've already passed it but it's close behind, reverse back to it.
    const pos = this.posAt(this.traveled);
    if (at < this.traveled && haversineMeters(pos, { lat, lng }) <= REVERSE_MAX_M) {
      this.dir = -1;
    }
  }

  private async tick(stepM: number): Promise<void> {
    const a = this.segmentBase();
    const pos = this.posAt(this.traveled);
    const ping: VanPing = {
      vanId: this.vanId,
      lat: pos.lat,
      lng: pos.lng,
      headingDeg: bearingDeg(a.from, a.to),
      speedMps: DISPLAY_SPEED_MPS,
      reportedAt: new Date().toISOString(),
    };
    if (await this.geo.recordVanPosition(ping)) await this.engine.onVanPing(ping);

    // Reached a waiting customer on the route → stop here.
    const hit = this.pending.find((p) => haversineMeters(pos, { lat: p.lat, lng: p.lng }) <= STOP_RADIUS_M);
    if (hit) {
      await this.confirmStop(hit);
      this.stop();
      return;
    }

    this.traveled += this.dir * stepM;
    if (this.traveled >= this.totalLen) {
      this.traveled = this.totalLen;
      if (this.dir === 1) this.stop(); // reached the end with nobody to stop for
    } else if (this.traveled <= 0) {
      this.traveled = 0;
      this.dir = 1;
    }
  }

  private async confirmStop(stop: PendingStop): Promise<void> {
    await this.db.addStopConfirmation(this.vanId, stop.lat, stop.lng, []);
    const pending = await this.db.listPendingHandRaises(this.vanId);
    await this.db.acknowledgeHandRaises(pending.map((p) => p.id));
    this.realtime.toUser(stop.userId, {
      type: 'stop.confirmed',
      vanId: this.vanId,
      lat: stop.lat,
      lng: stop.lng,
      etaSeconds: 0,
    });
    const user = await this.db.getUser(stop.userId);
    if (user?.pushToken) {
      void this.push.send({
        token: user.pushToken,
        title: "We're stopping near you",
        body: 'The driver saw your request — stopping at your spot!',
        data: { kind: 'stop', vanId: this.vanId, lat: stop.lat, lng: stop.lng },
      });
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // ── geometry helpers ──
  private posAt(d: number): RoutePoint {
    const clamped = Math.max(0, Math.min(this.totalLen, d));
    let i = 1;
    while (i < this.cum.length && this.cum[i] < clamped) i++;
    const a = this.route[i - 1];
    const b = this.route[Math.min(i, this.route.length - 1)];
    const segLen = (this.cum[i] ?? this.cum[i - 1]) - this.cum[i - 1] || 1;
    const f = (clamped - this.cum[i - 1]) / segLen;
    return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
  }

  private segmentBase(): { from: RoutePoint; to: RoutePoint } {
    let i = 1;
    while (i < this.cum.length && this.cum[i] < this.traveled) i++;
    return { from: this.route[i - 1], to: this.route[Math.min(i, this.route.length - 1)] };
  }

  private nearestAlong(lat: number, lng: number): number {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < this.route.length; i++) {
      const d = haversineMeters(this.route[i], { lat, lng });
      if (d < bestD) {
        bestD = d;
        best = this.cum[i];
      }
    }
    return best;
  }
}
