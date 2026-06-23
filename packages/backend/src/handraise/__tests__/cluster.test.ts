import { describe, expect, it } from 'vitest';
import { clusterRaises } from '../cluster.js';

describe('clusterRaises (FR-008)', () => {
  it('groups raises on the same spot into one counted cluster', () => {
    const here = { lat: 47.1756, lng: 18.997 };
    const clusters = clusterRaises([
      { id: 'a', ...here },
      { id: 'b', lat: 47.17561, lng: 18.99701 }, // ~1m away
      { id: 'c', lat: 47.17559, lng: 18.99699 },
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].count).toBe(3);
    expect(clusters[0].handRaiseIds.sort()).toEqual(['a', 'b', 'c']);
  });

  it('keeps far-apart raises in separate clusters', () => {
    const clusters = clusterRaises([
      { id: 'a', lat: 47.1756, lng: 18.997 },
      { id: 'b', lat: 47.19, lng: 19.004 }, // ~1.6km away
    ]);
    expect(clusters).toHaveLength(2);
    expect(clusters.every((c) => c.count === 1)).toBe(true);
  });

  it('returns nothing for no raises', () => {
    expect(clusterRaises([])).toEqual([]);
  });
});
