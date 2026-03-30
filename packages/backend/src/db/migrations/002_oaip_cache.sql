CREATE TABLE oaip_airports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oaip_id      VARCHAR(100) UNIQUE NOT NULL,
  icao_code    VARCHAR(10),
  iata_code    VARCHAR(10),
  name         VARCHAR(255) NOT NULL,
  airport_type SMALLINT,
  location     GEOGRAPHY(POINT, 4326) NOT NULL,
  elevation_ft INTEGER,
  country      CHAR(2),
  raw_json     JSONB NOT NULL,
  cached_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX oaip_airports_location_idx ON oaip_airports USING GIST (location);
CREATE INDEX oaip_airports_icao_idx ON oaip_airports (icao_code) WHERE icao_code IS NOT NULL;
CREATE INDEX oaip_airports_country_idx ON oaip_airports (country);

CREATE TABLE oaip_frequencies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_oaip_id VARCHAR(100) NOT NULL REFERENCES oaip_airports(oaip_id) ON DELETE CASCADE,
  frequency_type  VARCHAR(50),
  frequency_mhz   NUMERIC(8,3),
  name            VARCHAR(100),
  raw_json        JSONB NOT NULL
);

CREATE INDEX oaip_freq_airport_idx ON oaip_frequencies (airport_oaip_id);

CREATE TABLE oaip_airspaces (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oaip_id         VARCHAR(100) UNIQUE NOT NULL,
  name            VARCHAR(255) NOT NULL,
  airspace_class  VARCHAR(5),
  airspace_type   SMALLINT,
  upper_limit_ft  INTEGER,
  upper_limit_ref VARCHAR(10),
  lower_limit_ft  INTEGER,
  lower_limit_ref VARCHAR(10),
  boundary        GEOGRAPHY(POLYGON, 4326) NOT NULL,
  country         CHAR(2),
  raw_json        JSONB NOT NULL,
  cached_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX oaip_airspaces_boundary_idx ON oaip_airspaces USING GIST (boundary);
CREATE INDEX oaip_airspaces_upper_idx ON oaip_airspaces (upper_limit_ft);
CREATE INDEX oaip_airspaces_country_idx ON oaip_airspaces (country);

CREATE TABLE cache_status (
  id           SERIAL PRIMARY KEY,
  data_type    VARCHAR(50) NOT NULL,
  country      CHAR(2) NOT NULL,
  fetched_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  record_count INTEGER,
  UNIQUE (data_type, country)
);
