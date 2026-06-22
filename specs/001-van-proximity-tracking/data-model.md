# Phase 1 Data Model: Van Proximity Tracking & Alerts

Derived from the spec's Key Entities and Functional Requirements. Storage is PostgreSQL + PostGIS;
Redis holds ephemeral presence (latest van position, socket routing) and is not the system of record.

## Entities

### Van
The ice cream van (location producer).
- `id` (uuid, pk)
- `name` (text)
- `status` (enum: `off_duty` | `on_duty`) — FR-009
- `last_seen_at` (timestamptz, nullable) — drives staleness (FR-014)
- `last_position` (geography(Point), nullable) — denormalized latest fix for fast reads

### VanPosition
A timestamped fix reported by a van (append-only). — FR-001
- `id` (bigserial, pk)
- `van_id` (uuid, fk → Van)
- `geom` (geography(Point), not null)
- `heading_deg` (real, 0–360, nullable)
- `speed_mps` (real, nullable) — feeds ETA (D5)
- `reported_at` (timestamptz, not null)
- Index: GiST on `geom`; btree on `(van_id, reported_at desc)`
- Rule: positions older than the latest seen for a van are ignored (out-of-order guard, Edge Cases)

### User
A resident. — FR-006, FR-007, FR-013
- `id` (uuid, pk)
- `display_name` (text)
- `role` (enum: `user` | `driver`) — FR-011 (single app, dual roles)
- `push_token` (text, nullable) — null ⇒ alerts off, live map still works
- `home_geom` (geography(Point), nullable) — optional reference point
- `last_geom` (geography(Point), nullable) — current location for proximity; **not** historized
  (Principle: location privacy / FR-013)

### Subscription
A user's interest in a van's alerts. — FR-006
- `id` (uuid, pk)
- `user_id` (uuid, fk → User)
- `van_id` (uuid, fk → Van)
- `radius_m` (int, default 3000) — outer "approaching" radius the user cares about
- Unique: `(user_id, van_id)`

### Visit
A single approach episode of a van toward a user, used to scope dedup. — FR-005 (one notif/state/visit)
- `id` (uuid, pk)
- `user_id` (uuid, fk → User)
- `van_id` (uuid, fk → Van)
- `opened_at` (timestamptz) — when van first entered the outer radius
- `closed_at` (timestamptz, nullable) — set after van leaves radius + cooldown
- `current_state` (enum: `none` | `approaching` | `arriving` | `here`)
- Rule: a new Visit opens only if the prior one is closed (prevents fly-by spam, allows re-trigger)

### Notification
Record of a delivered proximity alert; the dedup ledger. — FR-004, FR-005
- `id` (uuid, pk)
- `visit_id` (uuid, fk → Visit)
- `user_id` (uuid, fk → User)
- `van_id` (uuid, fk → Van)
- `state` (enum: `approaching` | `arriving` | `here`)
- `sent_at` (timestamptz)
- Unique: `(visit_id, state)` ⇒ at most one notification per state per visit (enforces FR-005)

### HandRaise
A user's request for a van to stop nearby. — FR-007, FR-008
- `id` (uuid, pk)
- `user_id` (uuid, fk → User)
- `van_id` (uuid, fk → Van)
- `geom` (geography(Point), not null) — where they want the stop
- `note` (text, nullable)
- `status` (enum: `pending` | `acknowledged` | `expired`)
- `created_at` (timestamptz)
- For the driver view, pending raises are clustered by proximity and counted (FR-008)

### StopConfirmation
A driver's acknowledgement that they will stop. — FR-010
- `id` (uuid, pk)
- `van_id` (uuid, fk → Van)
- `geom` (geography(Point), not null) — where the van will stop
- `created_at` (timestamptz)
- `hand_raise_ids` (uuid[]) — the raises this confirmation satisfies (those users get notified)

## Relationships

```text
Van 1───* VanPosition
Van 1───* Subscription *───1 User
User 1───* HandRaise *───1 Van
Van 1───* StopConfirmation
(User,Van) 1───* Visit 1───* Notification
StopConfirmation *───* HandRaise   (via hand_raise_ids)
```

## State machine — Visit.current_state (Principle IV)

```text
        van within ~1–3km AND heading toward user
 none ─────────────────────────────────────────────► approaching
   ▲                                                      │ within ~300m
   │ van leaves outer radius + cooldown                   ▼
   │                                                  arriving
   │                                                      │ within ~50m
   └──────────────── close visit ◄── here ◄──────────────┘
```
- Each forward transition emits exactly one ProximityEvent → at most one Notification per state
  (unique `(visit_id, state)`).
- Backward movement (van leaving) does **not** emit; it eventually closes the visit after a cooldown.
- A closed visit allows a fresh visit later (re-trigger on genuine re-approach).

## Validation rules (from requirements)

- A Notification cannot be created without an open Visit (FR-005).
- ProximityEvent for `approaching` requires heading-toward check, not distance alone (FR-003, Edge).
- VanPosition with `reported_at` ≤ the van's latest is rejected (out-of-order guard).
- `last_geom` is overwritten, never appended to a history table (FR-013 privacy).
- A van not `on_duty` produces no positions and no proximity events (FR-009).
