-- Family Ice — core schema (Foundational + User Story 1).
-- Idempotent: safe to run on every startup.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Vans (location producers) ---------------------------------------------------
CREATE TABLE IF NOT EXISTS vans (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         text NOT NULL,
  status       text NOT NULL DEFAULT 'off_duty' CHECK (status IN ('off_duty', 'on_duty')),
  last_seen_at timestamptz,
  last_geom    geography(Point, 4326),
  last_heading real
);

-- Append-only position history ------------------------------------------------
CREATE TABLE IF NOT EXISTS van_positions (
  id          bigserial PRIMARY KEY,
  van_id      uuid NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  geom        geography(Point, 4326) NOT NULL,
  heading_deg real,
  speed_mps   real,
  reported_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_van_positions_geom ON van_positions USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_van_positions_van_time ON van_positions (van_id, reported_at DESC);

-- Users (residents + drivers; single dual-role app) ---------------------------
CREATE TABLE IF NOT EXISTS users (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_name text NOT NULL,
  role         text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'driver')),
  push_token   text,
  -- Transient current location for proximity. Overwritten, never historized (FR-013 privacy).
  last_geom    geography(Point, 4326)
);

-- Subscriptions: which van's alerts a user wants ------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  van_id   uuid NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  radius_m integer NOT NULL DEFAULT 3000,
  UNIQUE (user_id, van_id)
);

-- Demo seed: a single van for the Kiskunlácháza approach demo.
INSERT INTO vans (id, name, status)
VALUES ('00000000-0000-0000-0000-0000000000a1', 'Family Ice — Van 1', 'off_duty')
ON CONFLICT (id) DO NOTHING;
