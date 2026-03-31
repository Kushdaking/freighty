-- ============================================================
-- Carrier Route Profile Migration
-- Prevaylos Platform — 2026-03-31
-- Adds deadhead/route optimization fields to carrier_users
-- ============================================================

ALTER TABLE carrier_users
  ADD COLUMN IF NOT EXISTS home_base_city VARCHAR,
  ADD COLUMN IF NOT EXISTS home_base_state VARCHAR,
  ADD COLUMN IF NOT EXISTS home_base_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS home_base_lng NUMERIC,
  ADD COLUMN IF NOT EXISTS preferred_corridors JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS max_deadhead_miles INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS next_available_location_city VARCHAR,
  ADD COLUMN IF NOT EXISTS next_available_location_state VARCHAR,
  ADD COLUMN IF NOT EXISTS next_available_location_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS next_available_location_lng NUMERIC,
  ADD COLUMN IF NOT EXISTS next_available_at TIMESTAMPTZ;

-- Index for geo queries on next available location
CREATE INDEX IF NOT EXISTS idx_carrier_users_next_available_location
  ON carrier_users (next_available_location_lat, next_available_location_lng)
  WHERE next_available_location_lat IS NOT NULL;

-- Index for home base geo queries
CREATE INDEX IF NOT EXISTS idx_carrier_users_home_base
  ON carrier_users (home_base_lat, home_base_lng)
  WHERE home_base_lat IS NOT NULL;

COMMENT ON COLUMN carrier_users.home_base_city IS 'Carrier home base city';
COMMENT ON COLUMN carrier_users.home_base_state IS 'Carrier home base state (2-letter code)';
COMMENT ON COLUMN carrier_users.home_base_lat IS 'Home base latitude';
COMMENT ON COLUMN carrier_users.home_base_lng IS 'Home base longitude';
COMMENT ON COLUMN carrier_users.preferred_corridors IS 'Array of {origin_state, destination_state} preferred routes';
COMMENT ON COLUMN carrier_users.max_deadhead_miles IS 'Max empty miles carrier will drive to pick up a load';
COMMENT ON COLUMN carrier_users.next_available_location_city IS 'Where carrier will be available next';
COMMENT ON COLUMN carrier_users.next_available_location_state IS 'State for next available location';
COMMENT ON COLUMN carrier_users.next_available_location_lat IS 'Latitude of next available location';
COMMENT ON COLUMN carrier_users.next_available_location_lng IS 'Longitude of next available location';
COMMENT ON COLUMN carrier_users.next_available_at IS 'When carrier expects to be available at next location';
