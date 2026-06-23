import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { ProximityState } from '@family-ice/shared';
import type { Db, HandRaiseRecord, PendingHandRaise, SubscriptionRecord, UserRecord } from '../../ports/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(here, 'db', 'migrations');

/** Local Db adapter over PostgreSQL. Runs SQL migrations idempotently on init. */
export class PgDb implements Db {
  private constructor(private readonly pool: pg.Pool) {}

  static async init(connectionString: string): Promise<PgDb> {
    const pool = new pg.Pool({ connectionString });
    // Apply migrations in filename order (idempotent SQL).
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files) {
      await pool.query(readFileSync(join(MIGRATIONS_DIR, f), 'utf8'));
    }
    return new PgDb(pool);
  }

  async createSession(displayName: string, role: 'user' | 'driver'): Promise<UserRecord> {
    const { rows } = await this.pool.query(
      `INSERT INTO users (display_name, role) VALUES ($1, $2)
       RETURNING id, display_name, role, push_token`,
      [displayName, role],
    );
    return mapUser(rows[0]);
  }

  async getUser(userId: string): Promise<UserRecord | null> {
    const { rows } = await this.pool.query(
      `SELECT id, display_name, role, push_token FROM users WHERE id = $1`,
      [userId],
    );
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async setPushToken(userId: string, token: string | null): Promise<void> {
    await this.pool.query(`UPDATE users SET push_token = $2 WHERE id = $1`, [userId, token]);
  }

  async addSubscription(userId: string, vanId: string, radiusM: number): Promise<SubscriptionRecord> {
    const { rows } = await this.pool.query(
      `INSERT INTO subscriptions (user_id, van_id, radius_m) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, van_id) DO UPDATE SET radius_m = EXCLUDED.radius_m
       RETURNING id, user_id, van_id, radius_m`,
      [userId, vanId, radiusM],
    );
    const r = rows[0];
    return { id: r.id, userId: r.user_id, vanId: r.van_id, radiusM: r.radius_m };
  }

  async removeSubscription(subscriptionId: string): Promise<void> {
    await this.pool.query(`DELETE FROM subscriptions WHERE id = $1`, [subscriptionId]);
  }

  async setVanDuty(vanId: string, status: 'on_duty' | 'off_duty'): Promise<void> {
    await this.pool.query(`UPDATE vans SET status = $2 WHERE id = $1`, [vanId, status]);
  }

  async addHandRaise(
    userId: string,
    vanId: string,
    lat: number,
    lng: number,
    note: string | null,
  ): Promise<HandRaiseRecord> {
    const { rows } = await this.pool.query(
      `INSERT INTO hand_raises (user_id, van_id, geom, note)
       VALUES ($1, $2, $3::geography, $4)
       RETURNING id, user_id, van_id, note, status, created_at,
                 ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng`,
      [userId, vanId, `SRID=4326;POINT(${lng} ${lat})`, note],
    );
    return mapHandRaise(rows[0]);
  }

  async listPendingHandRaises(vanId: string): Promise<PendingHandRaise[]> {
    const { rows } = await this.pool.query(
      `SELECT h.id, h.user_id, h.van_id, h.note, h.status, h.created_at,
              ST_Y(h.geom::geometry) AS lat, ST_X(h.geom::geometry) AS lng, u.push_token
       FROM hand_raises h JOIN users u ON u.id = h.user_id
       WHERE h.van_id = $1 AND h.status = 'pending'
       ORDER BY h.created_at`,
      [vanId],
    );
    return rows.map((r) => ({ ...mapHandRaise(r), pushToken: r.push_token }));
  }

  async acknowledgeHandRaises(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.pool.query(
      `UPDATE hand_raises SET status = 'acknowledged' WHERE id = ANY($1::uuid[])`,
      [ids],
    );
  }

  async addStopConfirmation(
    vanId: string,
    lat: number,
    lng: number,
    handRaiseIds: string[],
  ): Promise<string> {
    const { rows } = await this.pool.query(
      `INSERT INTO stop_confirmations (van_id, geom, hand_raise_ids)
       VALUES ($1, $2::geography, $3::uuid[]) RETURNING id`,
      [vanId, `SRID=4326;POINT(${lng} ${lat})`, handRaiseIds],
    );
    return rows[0].id;
  }

  async findOrRotateVisit(userId: string, vanId: string, cooldownMs: number): Promise<{ id: string }> {
    const { rows } = await this.pool.query(
      `SELECT id, closed_at, last_ping_at FROM visits
       WHERE user_id = $1 AND van_id = $2 ORDER BY opened_at DESC LIMIT 1`,
      [userId, vanId],
    );
    const latest = rows[0];
    if (latest && !latest.closed_at) {
      const idleMs = Date.now() - new Date(latest.last_ping_at).getTime();
      if (idleMs < cooldownMs) {
        await this.pool.query(`UPDATE visits SET last_ping_at = now() WHERE id = $1`, [latest.id]);
        return { id: latest.id };
      }
      // Stale open visit → close it before opening a fresh one.
      await this.pool.query(`UPDATE visits SET closed_at = now() WHERE id = $1`, [latest.id]);
    }
    const ins = await this.pool.query(
      `INSERT INTO visits (user_id, van_id) VALUES ($1, $2) RETURNING id`,
      [userId, vanId],
    );
    return { id: ins.rows[0].id };
  }

  async setVisitState(visitId: string, state: ProximityState): Promise<void> {
    await this.pool.query(`UPDATE visits SET current_state = $2 WHERE id = $1`, [visitId, state]);
  }

  async recordNotificationOnce(
    visitId: string,
    userId: string,
    vanId: string,
    state: ProximityState,
  ): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `INSERT INTO notifications (visit_id, user_id, van_id, state)
       VALUES ($1, $2, $3, $4) ON CONFLICT (visit_id, state) DO NOTHING`,
      [visitId, userId, vanId, state],
    );
    return rowCount === 1;
  }

  /** Exposed for the GeoStore adapter, which shares the same pool. */
  get rawPool(): pg.Pool {
    return this.pool;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

function mapUser(r: { id: string; display_name: string; role: string; push_token: string | null }): UserRecord {
  return { id: r.id, displayName: r.display_name, role: r.role as 'user' | 'driver', pushToken: r.push_token };
}

function mapHandRaise(r: {
  id: string; user_id: string; van_id: string; note: string | null;
  status: string; created_at: string; lat: number; lng: number;
}): HandRaiseRecord {
  return {
    id: r.id, userId: r.user_id, vanId: r.van_id, lat: r.lat, lng: r.lng,
    note: r.note, status: r.status as HandRaiseRecord['status'], createdAt: r.created_at,
  };
}
