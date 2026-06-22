# Phase 0 Research: Van Proximity Tracking & Alerts

No open `NEEDS CLARIFICATION` items remained from the spec (the scoping questions were resolved in
the originating conversation and captured under the spec's Assumptions). This document therefore
records the **technology decisions** and their rationale, each traced to a constitution principle.

## D1 — Telemetry transport (van → cloud): MQTT

- **Decision**: MQTT via a local broker (Mosquitto for simplicity, EMQX if a UI is wanted). Vans/sim
  publish to `van/{vanId}/loc`.
- **Rationale**: MQTT is the de-facto standard for telemetry from moving/intermittent devices —
  lightweight, QoS levels, tolerant of flaky mobile links. It maps 1:1 onto each cloud's managed
  ingest (AWS IoT Core, Azure IoT Hub, GCP Pub/Sub + MQTT bridge), satisfying Principle I.
- **Alternatives considered**: Raw WebSocket (no QoS/retain, weaker for intermittent producers);
  HTTP polling (chatty, poor for push-style telemetry); **Kafka — explicitly rejected** by
  Principle III (load is ~hundreds msg/s at national scale, not the throughput Kafka exists for).

## D2 — "Who is near the van?": PostGIS + Redis GEO

- **Decision**: PostGIS as the source of truth for positions/queries (`ST_DWithin`, `ST_Distance`);
  Redis for hot van presence and pub/sub fan-out to API instances.
- **Rationale**: The actual core of the product is a geospatial radius query, not a log. PostGIS is
  mature and exact; Redis GEO/`GEOSEARCH` gives low-latency presence. Behind the `GeoStore` port so a
  cloud swap (DynamoDB geo, Cosmos, Firestore) is config, per Principle I.
- **Alternatives considered**: In-memory haversine only (loses durability/history); a dedicated geo
  service (overkill at this scale).

## D3 — Fan-out (cloud → device): WebSocket (foreground) + push (background)

- **Decision**: WebSocket via Fastify for the live map while the app is open; push notifications for
  state transitions when backgrounded. Local push uses Expo Push; `PushService` port abstracts it.
- **Rationale**: These are two different needs — continuous map updates vs. wake-the-phone alerts.
  Expo Push works locally without per-cloud setup; the port maps later to SNS / Azure Notification
  Hubs / FCM (Principle I).
- **Alternatives considered**: Push-only (no smooth live map); WebSocket-only (no background alerts —
  fails the core "notify me when it's close" value).

## D4 — Proximity model: three states + heading + dedup

- **Decision**: Per van ping, for each subscribed user compute distance and bearing; classify into
  `approaching` (~1–3 km AND heading toward), `arriving` (~300 m), `here` (~50 m). Emit only on
  state *transitions*; persist a `notifications` row per (user, van, visit, state) to dedup.
- **Rationale**: Directly implements Principle IV. Heading filtering prevents false "coming to your
  street" when a van is merely nearby but leaving. A "visit" resets when the van leaves the outer
  radius for a cooldown, so a later genuine approach re-triggers.
- **Alternatives considered**: Single radius threshold (spammy, no early warning — violates IV);
  client-side geofencing only (unreliable in background on iOS, can't show wide-area approach).

## D5 — ETA for "coming to your street"

- **Decision**: Simple ETA = remaining route/great-circle distance ÷ recent average speed, recomputed
  per ping; shown as a coarse "~N min."
- **Rationale**: POC-appropriate and good enough for the demo; avoids a routing-engine dependency at
  runtime. Coarse display matches the inherent imprecision.
- **Alternatives considered**: Full turn-by-turn routing ETA (runtime dependency, against the
  offline-demo requirement of Principle V); kept as a future enhancement.

## D6 — Demo route generation: pre-fetch once, cache offline

- **Decision**: Generate the approach route once (OSRM public routing from a start ~2.5 km out to the
  destination), decode the polyline, and commit it as `packages/simulator/routes/kert-utca.geojson`.
  The simulator replays the cached file; no network at demo time.
- **Rationale**: Principle V — live demos must not depend on an external service. Caching makes every
  rehearsal and presentation identical.
- **Alternatives considered**: Hardcoded straight line (unconvincing, doesn't follow streets); live
  OSRM call during demo (network-dependent — rejected).

## D7 — Single Expo app, dual roles

- **Decision**: One Expo/React Native app; a role switch selects user vs. driver screens; shared
  contracts imported from `packages/shared`.
- **Rationale**: Principle II. ~70% shared code (map, networking, types); two phones in two roles is
  the demo.
- **Alternatives considered**: Two separate apps (doubles work, risks contract drift — rejected).

## D8 — Cloud-agnostic ports & adapters

- **Decision**: Define `MessageBus`, `GeoStore`, `PushService`, `Db` port interfaces. Provide `local`
  adapters (used now) and `aws`/`azure`/`gcp` adapter stubs with TODOs + an `infra/cloud-mapping.md`.
- **Rationale**: Principle I made structural — domain code imports interfaces, never SDKs, so "deploy
  to cloud X" is an adapter + config change.
- **Alternatives considered**: Deploy natively to all three now (≈3× effort, against the agreed
  local-first POC scope); direct SDK calls (the exact anti-pattern Principle I forbids).

## Resolved unknowns

None outstanding. All Technical Context fields are concrete; no item is marked NEEDS CLARIFICATION.
