ALTER TABLE trips ADD COLUMN owner_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE trip_shares (
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (trip_id, user_id)
);

CREATE INDEX trip_shares_user_idx ON trip_shares(user_id);

-- Assign existing trips to meirtolpin11@gmail.com
UPDATE trips SET owner_id = (SELECT id FROM users WHERE email = 'meirtolpin11@gmail.com');
