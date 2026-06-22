# Contract: REST API (Fastify)

Stateful actions and lookups not suited to the live socket. Stub auth (POC): a session token
identifies the user/role. All request/response bodies validated against `packages/shared` schemas.

## Auth (stub)
### `POST /auth/session`
```json
// req
{ "displayName": "Demo User", "role": "user" }      // role: user | driver
// res 200
{ "token": "sess_…", "userId": "…", "role": "user" }
```

## Vans
### `GET /vans` → list on-duty vans with last position (FR-001, FR-014)
```json
[ { "id": "5f1c…", "name": "Van 1", "status": "on_duty",
    "lastPosition": { "lat": 47.18, "lng": 18.99, "stale": false, "at": "…" } } ]
```

### `POST /vans/{vanId}/duty` (driver) → go on/off duty (FR-009)
```json
{ "status": "on_duty" }   // → 200 { "vanId":"…","status":"on_duty" }
```

## Subscriptions (FR-006)
### `POST /subscriptions`
```json
{ "vanId": "5f1c…", "radiusM": 3000 }   // → 201 { "id":"…","vanId":"…","radiusM":3000 }
```
### `DELETE /subscriptions/{id}` → 204

## Hand-raise (FR-007, FR-008)
### `POST /vans/{vanId}/handraise`
```json
// req
{ "lat": 47.1750, "lng": 18.9965, "note": "house with red door" }
// res 201
{ "id": "hr_…", "vanId": "5f1c…", "status": "pending", "createdAt": "…" }
```
### `GET /vans/{vanId}/handraises` (driver) → clustered pending raises (FR-008)
```json
{ "clusters": [ { "lat": 47.1756, "lng": 18.9970, "count": 3, "handRaiseIds": ["…"] } ] }
```

## Stop confirmation (FR-010)
### `POST /vans/{vanId}/stop`
```json
// req — driver confirms a stop, satisfying listed raises
{ "lat": 47.1755, "lng": 18.9971, "handRaiseIds": ["hr_…","hr_…"] }
// res 201
{ "id": "stop_…", "notifiedUsers": 3 }
```

## Push registration (FR-004)
### `POST /push/token`
```json
{ "pushToken": "ExponentPushToken[…]" }   // → 204 ; null/absent ⇒ alerts disabled, map still works
```

## Errors
Uniform shape: `{ "error": { "code": "VALIDATION_ERROR", "message": "…" } }` with appropriate HTTP
status. No endpoint returns another user's precise location.
