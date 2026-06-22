import type pg from 'pg';
import type Redis from 'ioredis';
import type { LatLng, Van, VanPing } from '@family-ice/shared';
import type { GeoStore, NearbyUser } from '../../ports/index.js';

/**
 * Local GeoStore adapter: PostGIS for exact geo queries (source of truth) + Redis as a
 * hot last-position cache. Cloud swap target: a geo-capable managed store.
 */
export class PostgisGeoStore implements GeoStore {
  constructor(
    private readonly pool: pg.Pool,
    private readonly redis: Redis,
    private readonly staleAfterMs: number,
  ) {}

  async recordVanPosition(ping: VanPing): Promise<boolean> {
    // Out-of-order guard: reject fixes not newer than the last accepted one.
    const { rows } = await this.pool.query(`SELECT last_seen_at FROM vans WHERE id = $1`, [ping.vanId]);
    if (!rows[0]) return false;
    const last = rows[0].last_seen_at ? new Date(rows[0].last_seen_at).getTime() : 0;
    if (new Date(ping.reportedAt).getTime() <= last) return false;

    const point = `SRID=4326;POINT(${ping.lng} ${ping.lat})`;
    await this.pool.query(
      `INSERT INTO van_positions (van_id, geom, heading_deg, speed_mps, reported_at)
       VALUES ($1, $2::geography, $3, $4, $5)`,
      [ping.vanId, point, ping.headingDeg, ping.speedMps, ping.reportedAt],
    );
    // A van reporting positions is, by definition, on duty (US3 adds explicit duty control).
    await this.pool.query(
      `UPDATE vans SET last_seen_at = $2, last_geom = $3::geography, last_heading = $4,
              status = 'on_duty' WHERE id = $1`,
      [ping.vanId, ping.reportedAt, point, ping.headingDeg],
    );
    await this.redis.set(
      `van:${ping.vanId}:pos`,
      JSON.stringify({ lat: ping.lat, lng: ping.lng, headingDeg: ping.headingDeg, at: ping.reportedAt }),
      'EX',
      60,
    );
    return true;
  }

  async getVan(vanId: string): Promise<Van | null> {
    const { rows } = await this.pool.query(
      `SELECT id, name, status, last_seen_at, last_heading,
              ST_Y(last_geom::geometry) AS lat, ST_X(last_geom::geometry) AS lng
       FROM vans WHERE id = $1`,
      [vanId],
    );
    return rows[0] ? this.mapVan(rows[0]) : null;
  }

  async listOnDutyVans(): Promise<Van[]> {
    const { rows } = await this.pool.query(
      `SELECT id, name, status, last_seen_at, last_heading,
              ST_Y(last_geom::geometry) AS lat, ST_X(last_geom::geometry) AS lng
       FROM vans WHERE status = 'on_duty'`,
    );
    return rows.map((r) => this.mapVan(r));
  }

  async findSubscribedUsersNear(vanId: string, point: LatLng, radiusM: number): Promise<NearbyUser[]> {
    const center = `SRID=4326;POINT(${point.lng} ${point.lat})`;
    const { rows } = await this.pool.query(
      `SELECT u.id, u.push_token, s.radius_m,
              ST_Y(u.last_geom::geometry) AS lat, ST_X(u.last_geom::geometry) AS lng
       FROM subscriptions s
       JOIN users u ON u.id = s.user_id
       WHERE s.van_id = $1
         AND u.last_geom IS NOT NULL
         AND ST_DWithin(u.last_geom, $2::geography, $3)`,
      [vanId, center, radiusM],
    );
    return rows.map((r) => ({
      userId: r.id,
      pushToken: r.push_token,
      location: { lat: r.lat, lng: r.lng },
      subscriptionRadiusM: r.radius_m,
    }));
  }

  async setUserLocation(userId: string, point: LatLng): Promise<void> {
    await this.pool.query(
      `UPDATE users SET last_geom = $2::geography WHERE id = $1`,
      [userId, `SRID=4326;POINT(${point.lng} ${point.lat})`],
    );
  }

  async close(): Promise<void> {
    // Pool/redis lifecycles owned by the composition root.
  }

  private mapVan(r: {
    id: string;
    name: string;
    status: string;
    last_seen_at: string | null;
    last_heading: number | null;
    lat: number | null;
    lng: number | null;
  }): Van {
    const seen = r.last_seen_at ? new Date(r.last_seen_at).getTime() : 0;
    const stale = !r.last_seen_at || Date.now() - seen > this.staleAfterMs;
    return {
      id: r.id,
      name: r.name,
      status: r.status as Van['status'],
      lastPosition:
        r.lat != null && r.lng != null
          ? { lat: r.lat, lng: r.lng, headingDeg: r.last_heading, stale, at: r.last_seen_at ?? '' }
          : null,
    };
  }
}
