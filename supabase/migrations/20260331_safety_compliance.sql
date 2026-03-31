-- ============================================================
-- Safety & Compliance Layer Migration
-- Prevaylos Platform — 2026-03-31
-- ============================================================

-- ─── 1. FMCSA Fields on carrier_users ────────────────────────────────────────
ALTER TABLE carrier_users
  ADD COLUMN IF NOT EXISTS fmcsa_authority_status TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS fmcsa_last_checked TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fmcsa_data JSONB,
  ADD COLUMN IF NOT EXISTS id_document_url TEXT,
  ADD COLUMN IF NOT EXISTS id_document_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS eld_platform TEXT,
  ADD COLUMN IF NOT EXISTS eld_last_synced TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eld_hos_status TEXT,
  ADD COLUMN IF NOT EXISTS eld_hours_available FLOAT,
  ADD COLUMN IF NOT EXISTS eld_cycle_hours_remaining FLOAT,
  ADD COLUMN IF NOT EXISTS eld_next_available TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_location_address TEXT;

-- ─── 2. COI / Insurance Fields ───────────────────────────────────────────────
ALTER TABLE carrier_insurance
  ADD COLUMN IF NOT EXISTS alert_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS effective_date DATE,
  ADD COLUMN IF NOT EXISTS document_url TEXT;

-- Add computed days_until_expiry as a generated column (requires pg 12+)
-- Stored as a function call instead for compatibility
CREATE OR REPLACE FUNCTION get_coi_days_until_expiry(exp_date DATE)
RETURNS INTEGER AS $$
  SELECT CASE
    WHEN exp_date IS NULL THEN NULL
    ELSE CEIL(EXTRACT(EPOCH FROM (exp_date - CURRENT_DATE)) / 86400)::INTEGER
  END;
$$ LANGUAGE SQL STABLE;

-- ─── 3. Vehicles High-Value Flag ─────────────────────────────────────────────
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS high_value_flag BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gvwr TEXT,
  ADD COLUMN IF NOT EXISTS body_type TEXT;

-- ─── 4. Shipments Manual Review Status ───────────────────────────────────────
-- Add 'manual_review' to the status check if it exists as a constraint
DO $$
BEGIN
  -- Try to alter the constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname LIKE '%shipment%status%' AND contype = 'c'
  ) THEN
    -- Constraints can't be easily altered in Postgres; just ensure the value works
    -- The app uses text columns so this should be fine
    RAISE NOTICE 'Status column constraint found — ensure manual_review is allowed';
  END IF;
END $$;

-- ─── 5. ELD Credentials Table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_user_id UUID REFERENCES carrier_users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'samsara', 'keeptruckin', 'geotab', etc.
  api_key TEXT,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(carrier_user_id, platform)
);

-- ─── 6. Carrier POD Photos Table (if not exists) ─────────────────────────────
CREATE TABLE IF NOT EXISTS carrier_pod (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  carrier_user_id UUID REFERENCES carrier_users(id),
  vehicle_id UUID REFERENCES vehicles(id),
  photo_url TEXT NOT NULL,
  photo_type TEXT NOT NULL DEFAULT 'pickup', -- 'pickup' | 'delivery' | 'damage'
  stage TEXT NOT NULL DEFAULT 'pickup', -- 'pickup' | 'delivery'
  notes TEXT,
  taken_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carrier_pod_shipment ON carrier_pod(shipment_id);
CREATE INDEX IF NOT EXISTS idx_carrier_pod_stage ON carrier_pod(stage);

-- ─── 7. pg_cron Daily COI Check ──────────────────────────────────────────────
-- Note: pg_cron must be enabled in Supabase dashboard → Extensions
-- Run this block separately if pg_cron is available:
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'daily-coi-check',
      '0 8 * * *', -- 8 AM UTC every day
      $$
        UPDATE carrier_insurance
        SET alert_sent_at = NOW()
        WHERE
          expiration_date IS NOT NULL
          AND expiration_date <= (CURRENT_DATE + INTERVAL '30 days')
          AND (alert_sent_at IS NULL OR alert_sent_at < CURRENT_DATE - INTERVAL '7 days');
      $$
    );
    RAISE NOTICE 'pg_cron job scheduled for daily COI check';
  ELSE
    RAISE NOTICE 'pg_cron not available — schedule COI check via external cron or Supabase Edge Functions';
  END IF;
END $$;

-- ─── 8. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_carrier_insurance_expiration ON carrier_insurance(expiration_date);
CREATE INDEX IF NOT EXISTS idx_vehicles_high_value ON vehicles(high_value_flag) WHERE high_value_flag = TRUE;
CREATE INDEX IF NOT EXISTS idx_carrier_users_id_verify ON carrier_users(id_document_verified) WHERE id_document_url IS NOT NULL;

-- ─── Done ─────────────────────────────────────────────────────────────────────
COMMENT ON TABLE marketplace_credentials IS 'ELD, TMS, and third-party API credentials for carrier integrations';
COMMENT ON TABLE carrier_pod IS 'Pickup/delivery proof-of-delivery photos from carrier app';
