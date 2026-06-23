import type { LatLng, ProximityState, Van, VanPing } from '@family-ice/shared';

/**
 * PORT INTERFACES (Constitution Principle I — Cloud-Agnostic by Construction).
 *
 * Domain code depends ONLY on these interfaces. Concrete adapters live in
 * `src/adapters/{local,aws,azure,gcp}`. No provider SDK (mqtt, pg, ioredis, aws-sdk…)
 * may be imported outside an adapter. The composition root (`src/index.ts`) is the only
 * place that picks an implementation.
 */

// ── MessageBus: telemetry transport (local: MQTT; cloud: IoT Core / IoT Hub / Pub-Sub) ──
export interface MessageBus {
  publish(topic: string, payload: unknown): Promise<void>;
  /** Subscribe to a topic pattern; handler receives the raw decoded JSON payload. */
  subscribe(topicPattern: string, handler: (topic: string, payload: unknown) => void): Promise<void>;
  close(): Promise<void>;
}

// ── GeoStore: positions + "who is near?" (local: PostGIS + Redis; cloud: geo-capable store) ──
export interface NearbyUser {
  userId: string;
  pushToken: string | null;
  location: LatLng;
  subscriptionRadiusM: number;
}

export interface GeoStore {
  /** Persist a van fix. Returns false if rejected as out-of-order (older than last seen). */
  recordVanPosition(ping: VanPing): Promise<boolean>;
  getVan(vanId: string): Promise<Van | null>;
  listOnDutyVans(): Promise<Van[]>;
  /** Subscribed users whose location is within `radiusM` of `point`, with their own radius. */
  findSubscribedUsersNear(vanId: string, point: LatLng, radiusM: number): Promise<NearbyUser[]>;
  /** Transient user location for proximity (not historized — Principle/privacy, FR-013). */
  setUserLocation(userId: string, point: LatLng): Promise<void>;
  close(): Promise<void>;
}

// ── PushService: background alerts (local: Expo Push; cloud: SNS / Notif Hubs / FCM) ──
export interface PushMessage {
  token: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

export interface PushService {
  send(message: PushMessage): Promise<void>;
}

// ── Db: relational entities (local: Postgres; cloud: managed Postgres / equivalent) ──
export interface UserRecord {
  id: string;
  displayName: string;
  role: 'user' | 'driver';
  pushToken: string | null;
}

export interface SubscriptionRecord {
  id: string;
  userId: string;
  vanId: string;
  radiusM: number;
}

export interface HandRaiseRecord {
  id: string;
  userId: string;
  vanId: string;
  lat: number;
  lng: number;
  note: string | null;
  status: 'pending' | 'acknowledged' | 'expired';
  createdAt: string;
}

/** A pending hand-raise enriched with the requester's push token (for stop notifications). */
export interface PendingHandRaise extends HandRaiseRecord {
  pushToken: string | null;
}

export interface Db {
  createSession(displayName: string, role: 'user' | 'driver'): Promise<UserRecord>;
  getUser(userId: string): Promise<UserRecord | null>;
  setPushToken(userId: string, token: string | null): Promise<void>;
  addSubscription(userId: string, vanId: string, radiusM: number): Promise<SubscriptionRecord>;
  removeSubscription(subscriptionId: string): Promise<void>;
  setVanDuty(vanId: string, status: 'on_duty' | 'off_duty'): Promise<void>;
  // ── Hand-raise / stop (User Story 3) ──
  addHandRaise(userId: string, vanId: string, lat: number, lng: number, note: string | null): Promise<HandRaiseRecord>;
  listPendingHandRaises(vanId: string): Promise<PendingHandRaise[]>;
  acknowledgeHandRaises(ids: string[]): Promise<void>;
  addStopConfirmation(vanId: string, lat: number, lng: number, handRaiseIds: string[]): Promise<string>;
  // ── Proximity visits + dedup (User Story 2) ──
  /** Return the active visit for (user,van), rotating to a fresh one if the last is stale. */
  findOrRotateVisit(userId: string, vanId: string, cooldownMs: number): Promise<{ id: string }>;
  setVisitState(visitId: string, state: ProximityState): Promise<void>;
  /** Record a notification for (visit,state); returns true only if it was newly inserted (dedup). */
  recordNotificationOnce(visitId: string, userId: string, vanId: string, state: ProximityState): Promise<boolean>;
  close(): Promise<void>;
}

/** Bundle of wired adapters handed to services by the composition root. */
export interface Ports {
  bus: MessageBus;
  geo: GeoStore;
  push: PushService;
  db: Db;
}

/** Re-export for adapter authors. */
export type { ProximityState };
