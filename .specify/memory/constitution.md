<!--
SYNC IMPACT REPORT
==================
Version change: (uninitialized template) → 1.0.0
Bump rationale: Initial ratification. Establishes the founding principles for the
                Family Ice POC. MAJOR=1 per first formal adoption.

Modified principles: none (initial adoption)
Added principles:
  - I.   Cloud-Agnostic by Construction
  - II.  Single Codebase, Dual Roles
  - III. Right-Sized Architecture (YAGNI)
  - IV.  Tiered Proximity & Notification Discipline
  - V.   Demo Reproducibility & Local-First
Added sections:
  - Additional Constraints: Technology & Privacy
  - Development Workflow & Quality Gates
  - Governance

Templates requiring updates:
  - ✅ .specify/templates/plan-template.md  (Constitution Check reads gates dynamically; no edit needed)
  - ✅ .specify/templates/spec-template.md  (no constitution references; aligned)
  - ✅ .specify/templates/tasks-template.md (no constitution references; aligned)

Follow-up TODOs: none
-->

# Family Ice Constitution

Family Ice is a proof-of-concept that tracks an ice cream van ("Family Frost", pseudonymized as
"Family Ice") in real time, alerts nearby users as the van approaches their street, and supports a
bidirectional "hand-raise / stop here" signal between users and the driver.

## Core Principles

### I. Cloud-Agnostic by Construction

Every external infrastructure dependency (message transport, datastore, geospatial index, push
delivery, blob storage) MUST be accessed through a port interface defined in `packages/backend/src/ports`.
Application and domain code MUST NOT import a cloud-provider SDK directly. Each port has a local
adapter (Docker) used today and one adapter stub per target cloud (AWS, Azure, GCP) proving the swap.

Rationale: The POC's stated goal is "runs anywhere." Honoring that means deployment to a cloud is a
configuration/adapter change, never a rewrite. Direct SDK imports are the single most common way that
goal silently dies, so they are prohibited rather than discouraged.

### II. Single Codebase, Dual Roles

The user app and driver app MUST ship from one Expo (React Native + TypeScript) codebase with a role
switch, not two projects. Shared domain types and event contracts MUST live in `packages/shared` and be
the single source of truth for both mobile and backend.

Rationale: The two apps are mirror images of the same data flow; duplicating maps, auth, networking,
and types would double the work and let the two sides drift out of contract.

### III. Right-Sized Architecture (YAGNI)

Tooling MUST be justified by the POC's actual scale (single city, ≤5 simulated vans, location pings
every ~2s). Heavyweight infrastructure that earns its keep only at high throughput — notably Kafka and
self-managed distributed log/streaming systems — MUST NOT be introduced for the POC. Prefer MQTT for
ingest, PostGIS/Redis GEO for proximity, and managed push for fan-out. New components require a one-line
load/throughput justification.

Rationale: The whole product is one moving producer per van fanning out to nearby phones — hundreds of
messages per second at national scale, not hundreds of thousands. Over-building obscures the demo and
inflates cost for no benefit.

### IV. Tiered Proximity & Notification Discipline

Proximity MUST be modeled as three distinct states — `approaching` (~1–3 km, heading toward user),
`arriving` (~300 m), and `here` (~50 m) — not a single radius threshold. Each user MUST receive each
state at most once per van visit; repeated pings within the same state MUST be de-duplicated against a
notifications record. Notifications MUST never be emitted faster than the underlying state changes.

Rationale: "Coming to your street" is a fundamentally different event from "the van is here." Collapsing
them produces either missed early warnings or a stream of spam every 2 seconds, which destroys the demo
and the product.

### V. Demo Reproducibility & Local-First

`docker-compose up` MUST boot the full backend stack cleanly with no manual steps. The canonical demo —
the van approaching Kert utca 14, 2340 Kiskunlácháza (lat 47.1754743, lon 18.9970884) — MUST be
runnable repeatably and offline: the approach route MUST be pre-fetched and cached to a local file so
no live external service is required during a presentation.

Rationale: Live demos fail on the dependency you forgot. Local-first development plus a cached, scripted
route means every rehearsal and every presentation produces the same approach, every time.

## Additional Constraints: Technology & Privacy

- **Stack**: Expo/React Native + TypeScript (mobile); Node + TypeScript Fastify (backend); MQTT
  (Mosquitto/EMQX) for van telemetry; PostGIS for geo queries; Redis for presence/pub-sub; Postgres for
  relational data; docker-compose for orchestration. Substitutions require a constitution amendment.
- **Location privacy**: Location data is sensitive. The POC MUST store only what the features require,
  MUST scope user location to subscription/proximity computation, and MUST NOT persist precise user
  tracks beyond what a hand-raise needs. No third-party analytics on raw location in the POC.
- **POC scope guardrails**: stub authentication (no production identity), no payments, no
  anti-counterfeit/brand-enforcement logic, single city/route, ≤5 simulated vans.

## Development Workflow & Quality Gates

- **Phased delivery**: Work proceeds in the agreed phases (0 skeleton → 1 ingest+live map →
  2 proximity+push → 3 hand-raise+driver → 4 cloud-ready proof). Each phase has a demoable deliverable.
- **Contract-first**: Changes to cross-boundary events/types are made in `packages/shared` first; both
  mobile and backend consume from there.
- **Port compliance gate**: Any PR adding infrastructure access MUST go through a port + adapter, never a
  direct SDK call (enforces Principle I).
- **Demo gate**: A phase is not "done" until its slice of the canonical Kiskunlácháza demo runs from a
  clean `docker-compose up`.

## Governance

This constitution supersedes ad-hoc practices for the Family Ice POC. Amendments MUST be made by editing
this file, MUST update the version per the policy below, and MUST record the change in the Sync Impact
Report comment at the top of this file.

Versioning policy (semantic):
- **MAJOR**: Backward-incompatible governance changes or removal/redefinition of a principle.
- **MINOR**: A new principle or materially expanded section.
- **PATCH**: Clarifications, wording, and non-semantic refinements.

Compliance: Plan and review steps MUST verify alignment with these principles; the plan template's
Constitution Check derives its gates from this file. Complexity that violates a principle MUST be
justified in writing in the plan's Complexity Tracking section or else removed.

**Version**: 1.0.0 | **Ratified**: 2026-06-22 | **Last Amended**: 2026-06-22
