-- Family Ice — User Story 2: proximity visits + de-duplicated notifications.
-- A "visit" is one approach episode of a van toward a user; it scopes dedup so each
-- proximity state fires at most once per visit (Constitution Principle IV). Idempotent.

CREATE TABLE IF NOT EXISTS visits (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  van_id        uuid NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  opened_at     timestamptz NOT NULL DEFAULT now(),
  last_ping_at  timestamptz NOT NULL DEFAULT now(),
  closed_at     timestamptz,
  current_state text NOT NULL DEFAULT 'none'
                CHECK (current_state IN ('none', 'approaching', 'arriving', 'here'))
);
CREATE INDEX IF NOT EXISTS idx_visits_user_van ON visits (user_id, van_id, opened_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id  uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  van_id    uuid NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  state     text NOT NULL CHECK (state IN ('approaching', 'arriving', 'here')),
  sent_at   timestamptz NOT NULL DEFAULT now(),
  -- THE dedup invariant: at most one notification per state per visit (SC-004, FR-005).
  UNIQUE (visit_id, state)
);
