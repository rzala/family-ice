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
