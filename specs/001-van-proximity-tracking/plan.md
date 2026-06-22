# Implementation Plan: Van Proximity Tracking & Alerts

**Branch**: `001-van-proximity-tracking` | **Date**: 2026-06-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-van-proximity-tracking/spec.md`

## Summary

Family Ice tracks an ice cream van in real time and alerts nearby residents as it approaches.
The approach: a moving location producer (route simulator + minimal driver app) publishes positions
over a lightweight telemetry transport; an ingest service writes them to a geospatial store; a
proximity engine classifies each van's distance + heading toward every subscribed user into three
ordered states (approaching / arriving / here), emitting de-duplicated events; those events fan out
to user devices via live socket (foreground map) and push notifications (background). A bidirectional
hand-raise / stop-here flow lets users request a stop and the driver confirm it. Everything runs
locally via `docker-compose` with all infrastructure behind swappable port interfaces, and ships a
repeatable, offline demo of a van approaching Kert utca 14, 2340 Kiskunlácháza.

## Technical Context

**Language/Version**: TypeScript 5.x — Node.js 20 (backend), Expo SDK 51 / React Native 0.74 (mobile)  
**Primary Dependencies**: Fastify (API + WebSocket), MQTT.js + Mosquitto/EMQX broker, `pg` + PostGIS,
`ioredis`, Expo (`expo-location`, `expo-notifications`), `react-native-maps`, Zod (shared contracts)  
**Storage**: PostgreSQL 16 + PostGIS (relational + geospatial); Redis 7 (van presence + pub/sub)  
**Testing**: Vitest (backend unit + proximity-engine logic), simulator-driven integration test for the
end-to-end demo path; lightweight component tests on mobile  
**Target Platform**: iOS 15+ / Android 10+ (Expo); Linux containers for backend; local docker-compose  
**Project Type**: Mobile + API (TypeScript monorepo with shared contracts package)  
**Performance Goals**: van position visible on map within ~2 s of movement; proximity evaluation per
ping for ≤5 vans is sub-millisecond; hand-raise round-trip visible within ~5 s  
**Constraints**: local-first (clean `docker-compose up`), offline-capable demo (cached approach
route), all cloud-replaceable concerns behind port interfaces (no provider SDK in domain code)  
**Scale/Scope**: POC — single town, ≤5 simulated vans, pings every ~2 s (~hundreds msg/s headroom)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Gate | Status |
|---|-----------|------|--------|
| I | Cloud-Agnostic by Construction | Infra accessed only via `packages/backend/src/ports/*`; local adapters now, AWS/Azure/GCP stubs; no cloud SDK imported in domain code | ✅ PASS — design defines `MessageBus`, `GeoStore`, `PushService`, `Db` ports with local adapters + per-cloud stub adapters |
| II | Single Codebase, Dual Roles | One Expo app with user/driver role switch; cross-boundary types live in `packages/shared` | ✅ PASS — single `packages/mobile` app; all events/types sourced from `packages/shared` |
| III | Right-Sized Architecture (YAGNI) | No Kafka / self-managed streaming; tooling justified by actual scale | ✅ PASS — MQTT + PostGIS + Redis only; load is ~hundreds msg/s at most |
| IV | Tiered Proximity & Notification Discipline | Three distinct states; ≤1 notification per state per visit (dedup) | ✅ PASS — proximity engine emits state transitions; `notifications` record enforces dedup; visit reset on leave |
| V | Demo Reproducibility & Local-First | `docker-compose up` boots clean; canonical Kiskunlácháza approach runs offline from a cached route | ✅ PASS — route pre-fetched to `packages/simulator/routes/*.geojson`; no live external dependency at demo time |

**Result**: All gates pass. No violations → Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-van-proximity-tracking/
├── plan.md              # This file
├── research.md          # Phase 0 output — decisions & rationale
├── data-model.md        # Phase 1 output — entities, relationships, state machine
├── quickstart.md        # Phase 1 output — clean-checkout-to-demo steps
├── contracts/           # Phase 1 output — MQTT topics, WS events, REST, push payloads
│   ├── mqtt-topics.md
│   ├── ws-events.md
│   ├── rest-api.md
│   └── push-payloads.md
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit.specify)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
icecreampop/
├── docker-compose.yml              # postgres+postgis, redis, mqtt broker, api, worker
├── package.json                    # workspace root (pnpm/npm workspaces)
├── packages/
│   ├── shared/                     # Principle II: single source of truth for contracts
│   │   └── src/
│   │       ├── events.ts           # VanPing, ProximityEvent, HandRaise, StopConfirm (Zod)
│   │       └── types.ts            # Van, User, Subscription enums + DTOs
│   ├── backend/
│   │   └── src/
│   │       ├── ports/              # Principle I: MessageBus, GeoStore, PushService, Db
│   │       ├── adapters/
│   │       │   ├── local/          # mqtt, postgis, redis, expo-push
│   │       │   ├── aws/            # IoT Core / DynamoDB / SNS stubs (TODO)
│   │       │   ├── azure/          # IoT Hub / Cosmos / Notification Hubs stubs (TODO)
│   │       │   └── gcp/            # Pub/Sub / Firestore / FCM stubs (TODO)
│   │       ├── proximity/          # Principle IV: tiered engine + ETA + dedup
│   │       ├── ingest/             # MQTT subscriber → GeoStore
│   │       ├── api/                # Fastify REST + WebSocket
│   │       └── index.ts            # composition root (wires ports → local adapters)
│   ├── simulator/
│   │   ├── routes/                 # cached GeoJSON approach routes (offline demo)
│   │   └── src/                    # CLI: replay route → publish pings over MQTT
│   └── mobile/                     # Expo app, user + driver roles
│       └── src/
│           ├── roles/              # user/ and driver/ screens
│           ├── map/                # react-native-maps view + markers
│           ├── notifications/      # expo-notifications wiring
│           └── api/                # REST + WS client (consumes packages/shared)
└── infra/
    ├── cloud-mapping.md            # Principle I: which managed service replaces each local part
    └── (aws|azure|gcp)/            # IaC skeletons per cloud
```

**Structure Decision**: TypeScript monorepo (Mobile + API). `packages/shared` enforces Principle II
(one contract for both sides). `packages/backend/src/ports` + `adapters/{local,aws,azure,gcp}` enforce
Principle I (cloud-agnostic). `packages/simulator` and `packages/mobile` (single app, dual roles)
satisfy the simulator-plus-driver-app decision and Principle II respectively.

## Complexity Tracking

> No constitution violations. Section intentionally empty.
