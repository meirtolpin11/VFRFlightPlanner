CREATE TABLE oaip_reporting_points (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oaip_id     VARCHAR(100) UNIQUE NOT NULL,
  name        VARCHAR(255) NOT NULL,
  compulsory  BOOLEAN DEFAULT false,
  location    GEOGRAPHY(POINT, 4326) NOT NULL,
  country     CHAR(2),
  raw_json    JSONB NOT NULL,
  cached_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX oaip_rp_location_idx ON oaip_reporting_points USING GIST (location);
CREATE INDEX oaip_rp_country_idx ON oaip_reporting_points (country);
