import Constants from 'expo-constants';

/**
 * Backend endpoints. Resolution order:
 *   1. EXPO_PUBLIC_* env (inlined at build/start — best for switching per environment)
 *   2. app.json `extra` (committed default)
 *   3. hard fallback
 *
 * Defaults point at the deployed backend (familyice.dev.trafty.com) so a device demo works
 * over the internet with no LAN/localhost fiddling. For local-only dev, run with
 * EXPO_PUBLIC_API_BASE=http://<your-lan-ip>:3000 EXPO_PUBLIC_WS_URL=ws://<your-lan-ip>:3000/ws.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as { apiBaseUrl?: string; wsUrl?: string };

export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? extra.apiBaseUrl ?? 'https://familyice.dev.trafty.com';
export const WS_URL =
  process.env.EXPO_PUBLIC_WS_URL ?? extra.wsUrl ?? 'wss://familyice.dev.trafty.com/ws';

/** The seeded demo van (matches the backend migration + simulator default). */
export const DEMO_VAN_ID = '00000000-0000-0000-0000-0000000000a1';
