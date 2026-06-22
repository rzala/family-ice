import { describe, expect, it } from 'vitest';
import { classify } from '../classify.js';
import { bearingDeg } from '../geo.js';

const cfg = { approachingMaxM: 3000, arrivingMaxM: 300, hereMaxM: 50, headingToleranceDeg: 60 };

// Kert utca 14 (demo destination) and a point ~1.5 km north of it.
const dest = { lat: 47.1754743, lng: 18.9970884 };
const northOfDest = { lat: 47.189, lng: 18.9970884 };

describe('classify — approaching requires heading toward the user (FR-003)', () => {
  it('flags approaching when ~1.5 km out and driving south toward the user', () => {
    const headingTowardUser = bearingDeg(northOfDest, dest); // ~180° (south)
    const c = classify(northOfDest, headingTowardUser, 8.3, dest, cfg);
    expect(c.state).toBe('approaching');
    expect(c.distanceM).toBeGreaterThan(300);
    expect(c.distanceM).toBeLessThanOrEqual(3000);
    expect(c.etaSeconds).toBeGreaterThan(0);
  });

  it('does NOT flag approaching when in range but driving AWAY (north)', () => {
    const c = classify(northOfDest, 0 /* due north, away from user */, 8.3, dest, cfg);
    expect(c.state).toBe('none');
  });

  it('treats unknown heading as inbound (cannot filter)', () => {
    const c = classify(northOfDest, null, null, dest, cfg);
    expect(c.state).toBe('approaching');
  });

  it('escalates to arriving then here as distance shrinks', () => {
    const near = { lat: 47.1775, lng: 18.9970884 }; // ~230 m
    const onTop = { lat: 47.17549, lng: 18.99709 }; // ~a few m
    expect(classify(near, 180, 8.3, dest, cfg).state).toBe('arriving');
    expect(classify(onTop, 180, 8.3, dest, cfg).state).toBe('here');
  });
});
