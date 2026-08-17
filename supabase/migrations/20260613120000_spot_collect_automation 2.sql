-- スポット自動収集・差分同期の制御テーブル

ALTER TABLE spots ADD COLUMN IF NOT EXISTS business_status text;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS deleted_reason text;

CREATE INDEX IF NOT EXISTS spots_last_synced_idx
  ON spots (last_synced_at NULLS FIRST)
  WHERE is_deleted = false;

CREATE TABLE IF NOT EXISTS collect_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT true,
  pace text NOT NULL DEFAULT 'free_tier'
    CHECK (pace IN ('free_tier', 'accelerated', 'unlimited')),
  daily_api_budget integer NOT NULL DEFAULT 150,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO collect_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS collect_usage (
  usage_date date PRIMARY KEY,
  search_calls integer NOT NULL DEFAULT 0,
  details_calls integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS area_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefecture text NOT NULL,
  municipality text NOT NULL,
  tile_key text NOT NULL,
  center_lat double precision NOT NULL,
  center_lng double precision NOT NULL,
  radius_m integer NOT NULL,
  categories text[] NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'collecting', 'done', 'error')),
  phase integer NOT NULL DEFAULT 1,
  last_collected_at timestamptz,
  found_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  api_calls integer NOT NULL DEFAULT 0,
  error_message text,
  UNIQUE (prefecture, municipality, tile_key)
);

CREATE INDEX IF NOT EXISTS area_coverage_status_idx
  ON area_coverage (status, phase, last_collected_at NULLS FIRST);
