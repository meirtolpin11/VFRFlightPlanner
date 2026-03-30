CREATE TABLE oaip_navaids (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oaip_id     VARCHAR(100) UNIQUE NOT NULL,
  name        VARCHAR(255) NOT NULL,
  ident       VARCHAR(20),
  navaid_type SMALLINT,
  frequency   NUMERIC(10,3),
  location    GEOGRAPHY(POINT, 4326) NOT NULL,
  country     CHAR(2),
  raw_json    JSONB NOT NULL,
  cached_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX oaip_navaids_location_idx ON oaip_navaids USING GIST (location);
CREATE INDEX oaip_navaids_country_idx ON oaip_navaids (country);
CREATE INDEX oaip_navaids_ident_idx ON oaip_navaids (ident) WHERE ident IS NOT NULL;
