CREATE TABLE IF NOT EXISTS sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id TEXT NOT NULL UNIQUE,
  name TEXT,
  region TEXT,
  geometry geometry(Polygon, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingest_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id TEXT NOT NULL,
  layer_type TEXT,
  coordinates geometry(Point, 4326),
  payload JSONB DEFAULT '{}'::jsonb,
  user_id TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sectors_read ON sectors;
CREATE POLICY sectors_read ON sectors
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS ingest_records_insert ON ingest_records;
CREATE POLICY ingest_records_insert ON ingest_records
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
    AND profiles.role IN ('ingest', 'analyst', 'admin')
  )
);