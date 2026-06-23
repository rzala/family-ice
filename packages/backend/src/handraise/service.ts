import type { WsHandRaiseUpdate } from '@family-ice/shared';
import type { Db } from '../ports/index.js';
import { clusterRaises } from './cluster.js';

/** Build the driver-facing clustered hand-raise snapshot for a van (FR-008). */
export async function buildHandRaiseUpdate(db: Db, vanId: string): Promise<WsHandRaiseUpdate> {
  const pending = await db.listPendingHandRaises(vanId);
  const clusters = clusterRaises(pending.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng })));
  return { type: 'handraise.update', vanId, clusters };
}
