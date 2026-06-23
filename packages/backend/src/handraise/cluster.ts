import { haversineMeters } from '../proximity/geo.js';

export interface RaisePoint {
  id: string;
  lat: number;
  lng: number;
}

export interface RaiseCluster {
  lat: number;
  lng: number;
  count: number;
  handRaiseIds: string[];
}

/**
 * Group nearby hand-raises so the driver sees "3 waiting on Elm St" rather than three pins
 * (FR-008). Greedy single-pass clustering: each raise joins the first existing cluster whose
 * running centroid is within `radiusM`, else starts a new one. Pure + unit-testable.
 */
export function clusterRaises(points: RaisePoint[], radiusM = 80): RaiseCluster[] {
  const acc: { lat: number; lng: number; ids: string[]; sumLat: number; sumLng: number }[] = [];
  for (const p of points) {
    let target = acc.find((c) => haversineMeters({ lat: c.lat, lng: c.lng }, p) <= radiusM);
    if (!target) {
      target = { lat: p.lat, lng: p.lng, ids: [], sumLat: 0, sumLng: 0 };
      acc.push(target);
    }
    target.ids.push(p.id);
    target.sumLat += p.lat;
    target.sumLng += p.lng;
    target.lat = target.sumLat / target.ids.length;
    target.lng = target.sumLng / target.ids.length;
  }
  return acc.map((c) => ({ lat: c.lat, lng: c.lng, count: c.ids.length, handRaiseIds: c.ids }));
}
