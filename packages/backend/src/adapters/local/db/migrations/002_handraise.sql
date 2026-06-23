-- Family Ice — User Story 3: hand-raise + stop confirmation.
-- Idempotent: safe to run on every startup.

CREATE TABLE IF NOT EXISTS hand_raises (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  van_id     uuid NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  geom       geography(Point, 4326) NOT NULL,
  note       text,
  status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hand_raises_van_status ON hand_raises (van_id, status);
CREATE INDEX IF NOT EXISTS idx_hand_raises_geom ON hand_raises USING GIST (geom);

CREATE TABLE IF NOT EXISTS stop_confirmations (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  van_id         uuid NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  geom           geography(Point, 4326) NOT NULL,
  hand_raise_ids uuid[] NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
);
