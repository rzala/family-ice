# 🍦 Family Ice

Real-time ice cream van **proximity tracking** POC. The app shows a van live on a map, tells
residents when it's *coming to their street* (with an ETA), pushes notifications as it gets close,
and supports a two-way **hand-raise → "I'll stop here"** flow between customers and the driver.

**Live:** https://familyice.trafty.com · **Demo destination:** Kert utca 14, 2340 Kiskunlácháza, HU

> Built spec-first with [GitHub Spec Kit](https://github.com/github/spec-kit). The full
> constitution / spec / plan / tasks live in [`specs/001-van-proximity-tracking/`](specs/001-van-proximity-tracking).

## What it does

| User story | Status |
|---|---|
| **US1** — live van on a map + "coming to your street" (distance + heading aware, ETA) | ✅ |
| **US2** — background push: *approaching → arriving → here*, de-duplicated (≤1 per state per visit) | ✅ |
| **US3** — hand-raise (customer) → clustered driver inbox → "I'll stop here" → customer notified | ✅ |

## Architecture

```
 producer (driver app / simulator / server demo)
        │  MQTT  van/{id}/loc
        ▼
   ingest ─► proximity engine ──► realtime hub (WebSocket)  ─► customer/driver apps
        │     (PostGIS ST_DWithin,    │  proximity.state, van.position, handraise.update…
        │      heading, tiered)       └─► notifier ─► PushService (de-duped via UNIQUE(visit,state))
        ▼
   GeoStore (PostGIS) + Db (Postgres) + Redis presence
```

**Cloud-agnostic by construction** (constitution Principle I): all infrastructure is behind four
port interfaces (`MessageBus`, `GeoStore`, `PushService`, `Db`) in
[`packages/backend/src/ports`](packages/backend/src/ports). Only the composition root names a
provider. Local adapters today; AWS/Azure/GCP are an adapter + env switch (see
[`infra/cloud-mapping.md`](infra/cloud-mapping.md)).

## Stack

- **Mobile**: Expo SDK 54 (React Native 0.81, React 19), `react-native-maps`, `expo-location`, `expo-notifications`
- **Backend**: Node 20 + TypeScript, Fastify (REST + WebSocket), in-process realtime hub
- **Data**: PostgreSQL + **PostGIS** (geo), Redis (presence), MQTT (telemetry)
- **Contracts**: a single Zod source of truth in [`packages/shared`](packages/shared), consumed by mobile + backend
- **Monorepo**: npm workspaces — `packages/{shared,backend,simulator,mobile}`

## Run locally

```bash
docker compose up                       # postgres+postgis, redis, mqtt, api  (clean boot, no manual steps)
curl localhost:3000/health              # {"ok":true}

cd packages/mobile && npm install && npx expo start   # scan QR with Expo Go
# Local dev override: EXPO_PUBLIC_API_BASE=http://<lan-ip>:3000 EXPO_PUBLIC_WS_URL=ws://<lan-ip>:3000/ws

# Drive the van along the cached Kiskunlácháza route (offline):
cd packages/simulator && npm run sim -- --to kert-utca --speed 30
```

See [`specs/001-van-proximity-tracking/quickstart.md`](specs/001-van-proximity-tracking/quickstart.md)
for the full walkthrough. There's also a self-contained **"Send van" button** in the app that triggers
a server-side demo drive (no simulator needed).

## Deploy

Runs on a Kubernetes cluster via Helm + ArgoCD + CloudNativePG + cert-manager/Cloudflare. Deploy
manifests live in a separate private repo (`mx.familyice.deploy`); the app image builds from
[`packages/backend/Dockerfile`](packages/backend/Dockerfile).

## Tests

```bash
npm run -w @family-ice/backend test     # proximity classification, visit dedup, hand-raise clustering
npm run typecheck
```

## Scope

POC: single town/route, stub auth, no payments, "Family Ice" is a pseudonym (brand-protection
cover). Ice-cream selection/ordering is intentionally out of scope (would be a new feature spec).
