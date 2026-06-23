import { describe, expect, it } from 'vitest';
import { Notifier } from '../notifier.js';
import type { Classification } from '../classify.js';
import type { Db, PushMessage, PushService } from '../../ports/index.js';

/** In-memory Db mimicking the UNIQUE(visit_id, state) ledger; one visit per (user,van). */
function fakeDb() {
  const notified = new Set<string>(); // `${visitId}:${state}`
  const db = {
    findOrRotateVisit: async (userId: string, vanId: string) => ({ id: `${userId}:${vanId}` }),
    setVisitState: async () => {},
    recordNotificationOnce: async (visitId: string, _u: string, _v: string, state: string) => {
      const key = `${visitId}:${state}`;
      if (notified.has(key)) return false;
      notified.add(key);
      return true;
    },
  } as unknown as Db;
  return db;
}

function fakePush() {
  const sends: PushMessage[] = [];
  const push = { send: async (m: PushMessage) => void sends.push(m) } as PushService;
  return { push, sends };
}

const c = (state: Classification['state'], distanceM = 1000, etaSeconds: number | null = 120): Classification => ({
  state,
  distanceM,
  etaSeconds,
});

describe('Notifier dedup (FR-005 / SC-004)', () => {
  it('sends at most one push per state per visit despite repeated pings', async () => {
    const { push, sends } = fakePush();
    const n = new Notifier(fakeDb(), push, 120_000);

    // Many pings while "approaching", then escalate.
    for (let i = 0; i < 5; i++) await n.handle('u1', 'van1', 'tok', c('approaching'));
    await n.handle('u1', 'van1', 'tok', c('arriving', 250, 30));
    await n.handle('u1', 'van1', 'tok', c('arriving', 240, 28));
    await n.handle('u1', 'van1', 'tok', c('here', 30, 0));
    await n.handle('u1', 'van1', 'tok', c('here', 20, 0));

    expect(sends.map((s) => s.data.state)).toEqual(['approaching', 'arriving', 'here']);
  });

  it('never pushes for the none state', async () => {
    const { push, sends } = fakePush();
    const n = new Notifier(fakeDb(), push, 120_000);
    await n.handle('u1', 'van1', 'tok', c('none', 9999, null));
    expect(sends).toHaveLength(0);
  });

  it('does not push when the user has no token (alerts disabled), but still records the visit', async () => {
    const { push, sends } = fakePush();
    const n = new Notifier(fakeDb(), push, 120_000);
    await n.handle('u2', 'van1', null, c('approaching'));
    expect(sends).toHaveLength(0);
  });

  it('keeps separate users independent', async () => {
    const { push, sends } = fakePush();
    const n = new Notifier(fakeDb(), push, 120_000);
    await n.handle('a', 'van1', 'tA', c('here', 10, 0));
    await n.handle('b', 'van1', 'tB', c('here', 10, 0));
    expect(sends).toHaveLength(2); // one each, different visits
  });
});
