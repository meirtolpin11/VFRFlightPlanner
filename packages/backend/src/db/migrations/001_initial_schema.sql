CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE airplanes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL,
  registration    VARCHAR(20),
  cruise_tas_kts  SMALLINT NOT NULL,
  fuel_consumption NUMERIC(6,2) NOT NULL,
  fuel_unit       VARCHAR(5) NOT NULL CHECK (fuel_unit IN ('gal', 'L')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trips (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE flights (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id        UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name           VARCHAR(255) NOT NULL,
  airplane_id    UUID REFERENCES airplanes(id) ON DELETE SET NULL,
  sort_order     SMALLINT NOT NULL DEFAULT 0,
  visible_on_map BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE waypoints (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  icao_code     VARCHAR(10),
  waypoint_type VARCHAR(30) NOT NULL CHECK (waypoint_type IN ('airport', 'vrp', 'custom', 'coordinate')),
  location      GEOGRAPHY(POINT, 4326) NOT NULL,
  elevation_ft  SMALLINT,
  notes         TEXT,
  is_custom     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX waypoints_location_idx ON waypoints USING GIST (location);
CREATE INDEX waypoints_icao_idx ON waypoints (icao_code) WHERE icao_code IS NOT NULL;
CREATE INDEX waypoints_type_idx ON waypoints (waypoint_type);

CREATE TABLE legs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id    UUID NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
  sort_order   SMALLINT NOT NULL DEFAULT 0,
  name         VARCHAR(255),
  departure_id UUID NOT NULL REFERENCES waypoints(id),
  arrival_id   UUID NOT NULL REFERENCES waypoints(id),
  color        VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE leg_waypoints (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leg_id      UUID NOT NULL REFERENCES legs(id) ON DELETE CASCADE,
  waypoint_id UUID NOT NULL REFERENCES waypoints(id),
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  UNIQUE (leg_id, sort_order)
);

CREATE TABLE custom_markers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waypoint_id UUID NOT NULL REFERENCES waypoints(id) ON DELETE CASCADE,
  label       VARCHAR(100) NOT NULL,
  marker_type VARCHAR(30) NOT NULL DEFAULT 'info' CHECK (marker_type IN ('fuel', 'avoid', 'info', 'checkpoint', 'alternate')),
  color       VARCHAR(7),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE leg_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leg_id      UUID NOT NULL REFERENCES legs(id) ON DELETE CASCADE,
  author_name VARCHAR(100) NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed a default airplane
INSERT INTO airplanes (name, registration, cruise_tas_kts, fuel_consumption, fuel_unit, notes)
VALUES ('Cessna 172', 'G-ABCD', 122, 8.5, 'gal', 'Default Cessna 172 profile');
