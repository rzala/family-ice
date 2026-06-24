import type { VanPing } from '@family-ice/shared';
import type { Db, GeoStore } from '../ports/index.js';
import type { ProximityEngine } from '../proximity/engine.js';
import { bearingDeg, haversineMeters } from '../proximity/geo.js';
import { KERT_UTCA_ROUTE } from './route.js';

/**
 * Server-side demo driver: replays the Kert utca approach route through the same ingest →
 * proximity path the simulator/driver use, so a single client tap drives the van for everyone.
 *
 * The trick (per the demo requirement): the van ADVANCES fast — the whole ~3.6 km route in
 * ~2 minutes of wall-clock — but each ping reports a REALISTIC ground speed, so the ETA the
 * engine computes (distance ÷ reported-speed) reads "~5 min" and counts down naturally. The
 * displayed ETA is decoupled from how fast the marker actually moves.
 */
const DISPLAY_SPEED_MPS = 8.3; // ~30 km/h → ~5 min ETA when ~2.5 km out (what the banner shows)
const DURATION_S = 120; // real wall-clock to traverse the whole route (~2 min)
const INTERVAL_MS = 1500;

export class DemoDriver {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly geo: GeoStore,
    private readonly engine: ProximityEngine,
    private readonly db: Db,
  ) {}

  async start(vanId: string): Promise<void> {
    this.stop(); // restart cleanly if a demo is already running

    // Close any open visits so each demo re-fires the approaching/arriving/here pushes
    // (otherwise the prior visit's notifications would suppress them).
    await this.db.closeOpenVisitsForVan(vanId);

    const route = KERT_UTCA_ROUTE;
    const totalLen = route.reduce((s, _p, i) => (i ? s + haversineMeters(route[i - 1], route[i]) : 0), 0);
    const ticks = Math.max(1, Math.round((DURATION_S * 1000) / INTERVAL_MS));
    const stepM = totalLen / ticks;

    let seg = 0;
    let segPos = 0;
    const tick = async () => {
      if (seg >= route.length - 1) {
        this.stop();
        return;
      }
      const a = route[seg];
      const b = route[seg + 1];
      const segLen = haversineMeters(a, b) || 0.0001;
      const f = Math.min(segPos / segLen, 1);
      const ping: VanPing = {
        vanId,
        lat: a.lat + (b.lat - a.lat) * f,
        lng: a.lng + (b.lng - a.lng) * f,
        headingDeg: bearingDeg(a, b),
        speedMps: DISPLAY_SPEED_MPS, // realistic reported speed → ~5 min ETA
        reportedAt: new Date().toISOString(),
      };
      if (await this.geo.recordVanPosition(ping)) await this.engine.onVanPing(ping);

      segPos += stepM; // advance fast (covers the route in ~DURATION_S)
      while (seg < route.length - 1 && segPos >= haversineMeters(route[seg], route[seg + 1])) {
        segPos -= haversineMeters(route[seg], route[seg + 1]);
        seg++;
      }
    };

    this.timer = setInterval(() => void tick(), INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
