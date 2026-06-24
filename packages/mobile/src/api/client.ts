import type { Role } from '@family-ice/shared';
import { API_BASE } from '../config';

/** REST client for the Family Ice backend (stub-auth session token). */

export interface SessionResponse {
  token: string;
  userId: string;
  role: Role;
}

export async function createSession(role: Role, displayName = 'Demo'): Promise<SessionResponse> {
  const res = await fetch(`${API_BASE}/auth/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role, displayName }),
  });
  if (!res.ok) throw new Error(`session failed: ${res.status}`);
  return res.json();
}

export async function subscribeToVan(token: string, vanId: string, radiusM = 3000): Promise<void> {
  const res = await fetch(`${API_BASE}/subscriptions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ vanId, radiusM }),
  });
  if (!res.ok && res.status !== 201) throw new Error(`subscribe failed: ${res.status}`);
}

export async function registerPushToken(token: string, pushToken: string | null): Promise<void> {
  await fetch(`${API_BASE}/push/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ pushToken }),
  });
}

const authJson = (token: string) => ({
  'content-type': 'application/json',
  authorization: `Bearer ${token}`,
});

// ── User Story 3 ──
export async function raiseHand(
  token: string,
  vanId: string,
  lat: number,
  lng: number,
  note: string | null = null,
): Promise<void> {
  const res = await fetch(`${API_BASE}/vans/${vanId}/handraise`, {
    method: 'POST',
    headers: authJson(token),
    body: JSON.stringify({ lat, lng, note }),
  });
  if (!res.ok && res.status !== 201) throw new Error(`handraise failed: ${res.status}`);
}

export async function setDuty(token: string, vanId: string, status: 'on_duty' | 'off_duty'): Promise<void> {
  await fetch(`${API_BASE}/vans/${vanId}/duty`, {
    method: 'POST',
    headers: authJson(token),
    body: JSON.stringify({ status }),
  });
}

export interface HandRaiseClusters {
  vanId: string;
  clusters: { lat: number; lng: number; count: number; handRaiseIds: string[] }[];
}

export async function getHandRaises(token: string, vanId: string): Promise<HandRaiseClusters> {
  const res = await fetch(`${API_BASE}/vans/${vanId}/handraises`, { headers: authJson(token) });
  return res.json();
}

/** (Re)start the self-contained server-side demo drive toward subscribers. */
export async function startDemoDrive(token: string, vanId: string): Promise<void> {
  await fetch(`${API_BASE}/vans/${vanId}/demo`, { method: 'POST', headers: authJson(token) });
}

export async function confirmStop(
  token: string,
  vanId: string,
  lat: number,
  lng: number,
  handRaiseIds: string[],
): Promise<{ notifiedUsers: number }> {
  const res = await fetch(`${API_BASE}/vans/${vanId}/stop`, {
    method: 'POST',
    headers: authJson(token),
    body: JSON.stringify({ lat, lng, handRaiseIds }),
  });
  return res.json();
}
