# Tasks: Van Proximity Tracking & Alerts

**Input**: Design documents from `/specs/001-van-proximity-tracking/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: A minimal, high-value test set is included (proximity-engine correctness + the
one-notification-per-state-per-visit invariant from SC-004, plus an end-to-end demo test). Full TDD
was not requested; test tasks are marked optional and may be skipped for a faster POC.

**Organization**: Tasks are grouped by user story (P1 → P2 → P3) so each is an independently
testable, demoable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3 (user-story phases only)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo and toolchain initialization (Principle II: one codebase + shared contracts)

- [ ] T001 Create monorepo structure per plan.md (`packages/{shared,backend,simulator,mobile}`, `infra/`) at repo root
- [ ] T002 [P] Initialize workspace root with npm/pnpm workspaces + base TS config in `package.json`, `tsconfig.base.json`
- [ ] T003 [P] Configure ESLint + Prettier at repo root in `.eslintrc.cjs`, `.prettierrc`
- [ ] T004 [P] Scaffold `packages/shared` (Zod + build) in `packages/shared/package.json`, `packages/shared/src/index.ts`
- [ ] T005 [P] Scaffold `packages/backend` (Fastify, mqtt, pg, ioredis, vitest) in `packages/backend/package.json`, `packages/backend/tsconfig.json`
- [ ] T006 [P] Scaffold `packages/simulator` in `packages/simulator/package.json`, `packages/simulator/tsconfig.json`
- [ ] T007 [P] Initialize Expo app (SDK 51, react-native-maps, expo-location, expo-notifications) in `packages/mobile/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure every user story depends on. Enforces Principle I (ports/adapters) and V (clean `docker-compose up`).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T008 Author `docker-compose.yml` (postgres+postgis, redis, mqtt broker, api, worker) at repo root
- [ ] T009 [P] Define shared event + type contracts (VanPing, ProximityEvent, HandRaise, StopConfirm, enums) in `packages/shared/src/events.ts`, `packages/shared/src/types.ts`
- [ ] T010 [P] Define port interfaces `MessageBus`, `GeoStore`, `PushService`, `Db` in `packages/backend/src/ports/`
- [ ] T011 Core DB schema + migrations (vans, van_positions, users, subscriptions; PostGIS geography + GiST index) in `packages/backend/src/adapters/local/db/migrations/`
- [ ] T012 [P] Implement local `Db` adapter (pg) in `packages/backend/src/adapters/local/db.ts`
- [ ] T013 [P] Implement local `GeoStore` adapter (PostGIS `ST_DWithin` + Redis presence) in `packages/backend/src/adapters/local/geostore.ts`
- [ ] T014 [P] Implement local `MessageBus` adapter (MQTT.js) in `packages/backend/src/adapters/local/messagebus.ts`
- [ ] T015 Fastify app skeleton + WebSocket server + `GET /health` in `packages/backend/src/api/server.ts`
- [ ] T016 Stub auth (`POST /auth/session` + session-token middleware) in `packages/backend/src/api/auth.ts`
- [ ] T017 Composition root wiring ports → local adapters by env in `packages/backend/src/index.ts`
- [ ] T018 [P] Cloud adapter stubs (`aws/`, `azure/`, `gcp/`) + `infra/cloud-mapping.md` (Principle I) in `packages/backend/src/adapters/` and `infra/`

**Checkpoint**: Foundation ready — `docker compose up` boots clean; user stories can begin.

---

## Phase 3: User Story 1 - See the van and know it's coming (Priority: P1) 🎯 MVP

**Goal**: Live van on a map + a "coming to your street" indication with ETA while still far away.

**Independent Test**: Run the simulator toward a user location; the app shows the van moving in
near-real-time and a "coming to your street ~N min" banner while the van is 1–3 km out and inbound.

### Tests for User Story 1 (optional)

- [ ] T019 [P] [US1] Unit test: distance + bearing + ETA → `approaching` only when inbound, in `packages/backend/src/proximity/__tests__/approaching.test.ts`

### Implementation for User Story 1

- [ ] T020 [US1] MQTT ingest: subscribe `van/{id}/loc`, validate VanPing, reject out-of-order, write to GeoStore, in `packages/backend/src/ingest/index.ts`
- [ ] T021 [US1] Proximity engine — distance, bearing-toward check, `approaching` state + ETA (D5), in `packages/backend/src/proximity/engine.ts`
- [ ] T022 [US1] Broadcast `van.position` (+ `stale` flag) and `proximity.state` (approaching) over WS, in `packages/backend/src/api/ws.ts`
- [ ] T023 [US1] `GET /vans` (on-duty + last position + staleness, FR-014) in `packages/backend/src/api/vans.ts`
- [ ] T024 [US1] `POST /subscriptions` + `DELETE /subscriptions/{id}` in `packages/backend/src/api/subscriptions.ts`
- [ ] T025 [P] [US1] Simulator: replay cached GeoJSON route → publish pings every ~2 s over MQTT, in `packages/simulator/src/sim.ts`
- [ ] T026 [P] [US1] Build + commit the Kert utca approach route (OSRM fetch once → cache, D6) to `packages/simulator/routes/kert-utca.geojson` via `packages/simulator/src/route-build.ts`
- [ ] T027 [P] [US1] Mobile REST + WS client consuming `packages/shared`, in `packages/mobile/src/api/`
- [ ] T028 [US1] Mobile live map with van marker (react-native-maps), in `packages/mobile/src/map/MapScreen.tsx`
- [ ] T029 [US1] Mobile "coming to your street" banner with ETA, in `packages/mobile/src/map/ApproachBanner.tsx`
- [ ] T030 [US1] Mobile role switch + user-role shell, in `packages/mobile/src/roles/index.tsx`
- [ ] T030a [P] [US1] Mobile: acquire device location via expo-location and emit `user.location` over WS (FR-002/FR-003 require knowing the user's position), in `packages/mobile/src/location/useDeviceLocation.ts` *(remediation: analyze C1)*
- [ ] T030b [US1] Mobile: subscribe the user to a van — call `POST /subscriptions`, auto-subscribe on the user screen for the demo (FR-006), in `packages/mobile/src/roles/user/UserScreen.tsx` *(remediation: analyze C2)*

**Checkpoint**: US1 fully functional — live tracking + early-approach banner demoable on its own.

---

## Phase 4: User Story 2 - Get notified as the van gets close (Priority: P2)

**Goal**: Background push for `arriving` and `here`, exactly once per state per visit (no spam).

**Independent Test**: Background the app; drive the van through arriving (~300 m) and here (~50 m);
exactly one push per state arrives in order; repeated pings in the same band send nothing more.

### Tests for User Story 2 (optional)

- [ ] T031 [P] [US2] Unit test: visit state machine + `UNIQUE(visit_id,state)` dedup (SC-004) in `packages/backend/src/proximity/__tests__/visit-dedup.test.ts`

### Implementation for User Story 2

- [ ] T032 [US2] Migration: `visits` + `notifications` tables with `UNIQUE(visit_id, state)`, in `packages/backend/src/adapters/local/db/migrations/`
- [ ] T033 [US2] Extend proximity engine: full `approaching→arriving→here` state machine + visit open/close cooldown (re-trigger after leave), in `packages/backend/src/proximity/engine.ts`
- [ ] T034 [US2] Implement local `PushService` adapter (Expo Push) in `packages/backend/src/adapters/local/push.ts`
- [ ] T035 [US2] Notifier: check dedup ledger before send, persist `notifications` row, dispatch push + WS, in `packages/backend/src/proximity/notifier.ts`
- [ ] T036 [US2] `POST /push/token` (null ⇒ alerts off, map still works) in `packages/backend/src/api/push.ts`
- [ ] T037 [P] [US2] Mobile: expo-notifications registration + tap routing by `data.kind`, in `packages/mobile/src/notifications/index.ts`
- [ ] T038 [US2] Mobile: foreground `proximity.state` → arriving/here banner + map pulse, in `packages/mobile/src/map/MapScreen.tsx`

**Checkpoint**: US1 + US2 both work — tracking plus de-duplicated proximity push.

---

## Phase 5: User Story 3 - Raise my hand and have the driver stop (Priority: P3)

**Goal**: User raises hand → driver sees clustered requests → confirms stop → users notified.

**Independent Test**: From a user device raise a hand; the driver device shows it (clustered/counted);
driver confirms; the user receives "we're stopping near you" within ~5 s.

### Tests for User Story 3 (optional)

- [ ] T039 [P] [US3] Unit test: hand-raise clustering + counts (FR-008) in `packages/backend/src/handraise/__tests__/cluster.test.ts`

### Implementation for User Story 3

- [ ] T040 [US3] Migration: `hand_raises` + `stop_confirmations` (with `hand_raise_ids`), in `packages/backend/src/adapters/local/db/migrations/`
- [ ] T041 [US3] `POST /vans/{id}/handraise` in `packages/backend/src/api/handraise.ts`
- [ ] T042 [US3] `GET /vans/{id}/handraises` clustered + counted in `packages/backend/src/api/handraise.ts`
- [ ] T043 [US3] `POST /vans/{id}/stop` → create confirmation, notify raised users (push + WS), in `packages/backend/src/api/stop.ts`
- [ ] T044 [US3] WS `handraise.update` (driver) + `stop.confirmed` (user) broadcasts, in `packages/backend/src/api/ws.ts`
- [ ] T045 [US3] `POST /vans/{id}/duty` + publish `van/{id}/status` (FR-009), in `packages/backend/src/api/vans.ts`
- [ ] T046 [P] [US3] Mobile driver: on-duty toggle + live GPS broadcast, in `packages/mobile/src/roles/driver/DutyScreen.tsx`
- [ ] T047 [P] [US3] Mobile driver: hand-raise inbox (clusters + counts), in `packages/mobile/src/roles/driver/InboxScreen.tsx`
- [ ] T048 [US3] Mobile driver: "I'll stop here" confirm action, in `packages/mobile/src/roles/driver/InboxScreen.tsx`
- [ ] T049 [P] [US3] Mobile user: raise-hand button + "we're stopping near you" banner, in `packages/mobile/src/roles/user/UserScreen.tsx`

**Checkpoint**: All three stories independently functional — full bidirectional demo.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T050 [P] End-to-end demo test: simulator → ingest → proximity → push along the Kert utca route, **with latency assertions for SC-001 (~2 s position) and SC-005 (~5 s hand-raise round-trip)**, in `packages/backend/test/e2e-demo.test.ts` *(remediation: analyze U1)*
- [ ] T051 [P] Flesh out `infra/{aws,azure,gcp}` IaC skeletons + finalize `infra/cloud-mapping.md` (Principle I)
- [ ] T052 [P] Root `README.md` with architecture diagram + run instructions
- [ ] T053 Privacy pass: confirm user `last_geom` is overwritten (not historized) and scrub precise coords from logs (FR-013)
- [ ] T054 [P] Centralize tunable proximity thresholds + staleness window in `packages/backend/src/config.ts`
- [ ] T055 Run `quickstart.md` end-to-end on a clean checkout and fix any gaps (SC-007)

---

## Dependencies & Execution Order

### Phase dependencies
- **Setup (P1)** → no deps.
- **Foundational (P2)** → depends on Setup; **blocks all user stories**.
- **US1 / US2 / US3 (P3–P5)** → all depend on Foundational; then proceed in priority order or in parallel if staffed.
- **Polish (P6)** → depends on the desired stories being complete.

### User-story dependencies
- **US1 (P1)**: independent after Foundational — the MVP.
- **US2 (P2)**: extends the proximity engine from US1 (T033 edits T021's file) and adds the dedup ledger; independently testable.
- **US3 (P3)**: adds hand-raise/stop on top of the position + WS feed; independently testable.

### Within each story
- Tests (if used) before implementation. Migrations → adapters/services → endpoints → WS → mobile.
- Same-file tasks are sequential (e.g., T021 then T033 both touch `engine.ts`; T044 touches `ws.ts` after T022).

---

## Parallel Opportunities

- **Setup**: T002–T007 all [P].
- **Foundational**: T009, T010, T012, T013, T014, T018 [P] (distinct files) after T008/T011 land.
- **US1**: T025, T026, T027 [P] (simulator + route + mobile client are independent of backend WS work).
- **US2**: T031, T037 [P].
- **US3**: T039, T046, T047, T049 [P].
- **Polish**: T050, T051, T052, T054 [P].
- Across stories: with multiple developers, US1/US2/US3 can proceed in parallel once Foundational completes (mind the shared `engine.ts` and `ws.ts` files between US1↔US2↔US3).

### Parallel example: User Story 1
```bash
# After Foundational, launch the independent US1 tracks together:
Task: "Simulator route replay in packages/simulator/src/sim.ts"          # T025
Task: "Build + cache Kert utca route in packages/simulator/routes/"      # T026
Task: "Mobile REST + WS client in packages/mobile/src/api/"              # T027
```

---

## Implementation Strategy

### MVP first (User Story 1 only)
1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → **STOP & VALIDATE** (live map + approach banner against the Kert utca route) → demo. This alone is a compelling demo.

### Incremental delivery
- Foundational → **US1 (MVP demo)** → add **US2** (push) → add **US3** (hand-raise/driver). Each adds value without breaking the previous; each maps to one phase deliverable in plan.md.

---

## Notes
- [P] = different files, no incomplete-task dependency.
- Watch the shared files across stories: `engine.ts` (T021→T033), `ws.ts` (T022→T044), `vans.ts` (T023→T045) are sequential, not parallel.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
- Total: **57 tasks** (Setup 7, Foundational 11, US1 14, US2 8, US3 11, Polish 6). *(US1 includes T030a/T030b added per analyze remediation C1/C2.)*
