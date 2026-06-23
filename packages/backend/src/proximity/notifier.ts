import type { ProximityState } from '@family-ice/shared';
import type { Db, PushMessage, PushService } from '../ports/index.js';
import type { Classification } from './classify.js';

/**
 * Notification dispatch with de-duplication (Constitution Principle IV).
 *
 * For each subscribed user the proximity engine evaluates per ping, this:
 *   1. resolves the active visit (rotating to a fresh one after a cooldown gap),
 *   2. records the proximity state against the visit's UNIQUE(visit_id, state) ledger,
 *   3. sends a push ONLY when that (visit, state) row was newly inserted.
 *
 * Net effect: at most one push per state per visit, no matter how many pings arrive
 * while the van sits in the same band (FR-005 / SC-004).
 */
export class Notifier {
  constructor(
    private readonly db: Db,
    private readonly push: PushService,
    private readonly cooldownMs: number,
  ) {}

  async handle(
    userId: string,
    vanId: string,
    pushToken: string | null,
    c: Classification,
  ): Promise<void> {
    // 'none' means out of range or heading away — no visit work, no notification.
    if (c.state === 'none') return;

    const visit = await this.db.findOrRotateVisit(userId, vanId, this.cooldownMs);
    await this.db.setVisitState(visit.id, c.state);

    const isNew = await this.db.recordNotificationOnce(visit.id, userId, vanId, c.state);
    if (!isNew || !pushToken) return; // already notified this state, or alerts disabled

    await this.push.send(buildPush(pushToken, vanId, c));
  }
}

function buildPush(token: string, vanId: string, c: Classification): PushMessage {
  const etaMin = c.etaSeconds != null ? Math.max(1, Math.round(c.etaSeconds / 60)) : null;
  const copy: Record<Exclude<ProximityState, 'none'>, { title: string; body: string }> = {
    approaching: {
      title: '🍦 Coming to your street',
      body: etaMin ? `Family Ice is about ${etaMin} min away` : 'Family Ice is heading your way',
    },
    arriving: { title: 'Family Ice is arriving', body: 'The van is reaching your street' },
    here: { title: 'The van is here! 🍦', body: 'Family Ice has arrived near you' },
  };
  const state = c.state as Exclude<ProximityState, 'none'>;
  return {
    token,
    title: copy[state].title,
    body: copy[state].body,
    data: { kind: 'proximity', state, vanId, ...(c.etaSeconds != null ? { etaSeconds: c.etaSeconds } : {}) },
  };
}
