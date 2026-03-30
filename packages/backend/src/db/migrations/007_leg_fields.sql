ALTER TABLE legs
  ADD COLUMN IF NOT EXISTS visible         BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS altitude_profile JSONB;

ALTER TABLE waypoints
  DROP CONSTRAINT IF EXISTS waypoints_waypoint_type_check;

ALTER TABLE waypoints
  ADD CONSTRAINT waypoints_waypoint_type_check
    CHECK (waypoint_type IN ('airport', 'vrp', 'custom', 'coordinate', 'vor', 'ndb'));
