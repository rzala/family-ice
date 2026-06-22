# Contract: WebSocket Events (live updates → app foreground)

Bidirectional socket between the mobile app and the Fastify API. Used while the app is open; push
notifications (see push-payloads.md) cover the backgrounded case. All payloads are defined in
`packages/shared` (Principle II).

## Connection
`GET /ws?token={sessionToken}` → upgrades to WebSocket. Server authenticates the stub session and
associates the socket with the user (and role).

## Server → client

### `van.position`
Live van movement for the map (FR-001).
```json
{ "type": "van.position", "vanId": "5f1c…", "lat": 47.1812, "lng": 18.9991,
  "headingDeg": 213.5, "stale": false, "at": "…" }
```
`stale: true` when no fresh fix within the staleness window (FR-014).

### `proximity.state`
A van's proximity-state transition relative to this user (FR-002, FR-003).
```json
{ "type": "proximity.state", "vanId": "5f1c…", "state": "approaching",
  "distanceM": 1840, "etaSeconds": 300 }
```
`state ∈ approaching | arriving | here`. `etaSeconds` present for `approaching`.

### `handraise.update` (driver role)
Pending hand-raises clustered by location (FR-008).
```json
{ "type": "handraise.update", "vanId": "5f1c…",
  "clusters": [ { "lat": 47.1756, "lng": 18.9970, "count": 3, "handRaiseIds": ["…","…","…"] } ] }
```

### `stop.confirmed` (user role)
Driver has confirmed a stop relevant to this user (FR-010).
```json
{ "type": "stop.confirmed", "vanId": "5f1c…", "lat": 47.1755, "lng": 18.9971, "etaSeconds": 90 }
```

## Client → server

### `user.location`
User shares current location for proximity (FR-013 — used transiently, not historized).
```json
{ "type": "user.location", "lat": 47.1750, "lng": 18.9965 }
```

## Notes
- The server never streams other users' precise locations to clients (privacy).
- Reconnect is idempotent: on connect the server replays the latest `van.position` and current
  `proximity.state` so the map is correct immediately.
