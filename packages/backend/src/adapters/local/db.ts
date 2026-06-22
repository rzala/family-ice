import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { Db, SubscriptionRecord, UserRecord } from '../../ports/index.js';

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
