import { Router } from 'express'
import { pool } from '../db/pool'

export const tripsRouter = Router()

// Helper: check if a user can access a trip (owner or collaborator)
export async function canAccessTrip(userId: string, tripId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM trips t
     WHERE t.id = $1
       AND (t.owner_id = $2 OR EXISTS (
         SELECT 1 FROM trip_shares WHERE trip_id = t.id AND user_id = $2
       ))`,
    [tripId, userId]
  )
  return rows.length > 0
}

// Helper: check if a user is the owner of a trip
async function isOwner(userId: string, tripId: string): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT 1 FROM trips WHERE id = $1 AND owner_id = $2',
    [tripId, userId]
  )
  return rows.length > 0
}

tripsRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.userId
    const { rows } = await pool.query(
      `SELECT * FROM trips t
       WHERE t.owner_id = $1
          OR EXISTS (SELECT 1 FROM trip_shares WHERE trip_id = t.id AND user_id = $1)
       ORDER BY t.created_at DESC`,
      [userId]
    )
    const trips = []
    for (const row of rows) {
      const flights = await getFlightsForTrip(row.id)
      trips.push({ ...camelizeRow(row), flights })
    }
    res.json(trips)
  } catch (err) { next(err) }
})

tripsRouter.post('/', async (req, res, next) => {
  try {
    const { name, description } = req.body
    const userId = req.user!.userId
    if (!name) return res.status(400).json({ error: 'name required' })
    const { rows } = await pool.query(
      'INSERT INTO trips (name, description, owner_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description || null, userId]
    )
    res.status(201).json({ ...camelizeRow(rows[0]), flights: [] })
  } catch (err) { next(err) }
})

tripsRouter.get('/:tripId', async (req, res, next) => {
  try {
    const userId = req.user!.userId
    const { rows } = await pool.query('SELECT * FROM trips WHERE id = $1', [req.params.tripId])
    if (!rows[0]) return res.status(404).json({ error: 'Trip not found' })
    const accessible = await canAccessTrip(userId, req.params.tripId)
    if (!accessible) return res.status(403).json({ error: 'Forbidden' })
    const flights = await getFlightsForTrip(req.params.tripId)
    res.json({ ...camelizeRow(rows[0]), flights })
  } catch (err) { next(err) }
})

tripsRouter.put('/:tripId', async (req, res, next) => {
  try {
    const userId = req.user!.userId
    const owned = await isOwner(userId, req.params.tripId)
    if (!owned) {
      // Check if trip exists at all to give the right error
      const { rows: exists } = await pool.query('SELECT 1 FROM trips WHERE id = $1', [req.params.tripId])
      if (!exists.length) return res.status(404).json({ error: 'Trip not found' })
      return res.status(403).json({ error: 'Forbidden' })
    }
    const { name, description } = req.body
    const { rows } = await pool.query(
      'UPDATE trips SET name = COALESCE($1, name), description = COALESCE($2, description), updated_at = NOW() WHERE id = $3 RETURNING *',
      [name, description, req.params.tripId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Trip not found' })
    res.json(camelizeRow(rows[0]))
  } catch (err) { next(err) }
})

tripsRouter.delete('/:tripId', async (req, res, next) => {
  try {
    const userId = req.user!.userId
    const owned = await isOwner(userId, req.params.tripId)
    if (!owned) {
      const { rows: exists } = await pool.query('SELECT 1 FROM trips WHERE id = $1', [req.params.tripId])
      if (!exists.length) return res.status(404).json({ error: 'Trip not found' })
      return res.status(403).json({ error: 'Forbidden' })
    }
    await pool.query('DELETE FROM trips WHERE id = $1', [req.params.tripId])
    res.status(204).send()
  } catch (err) { next(err) }
})

// --- Share sub-routes ---

// GET /trips/:tripId/shares — list collaborators (owner only)
tripsRouter.get('/:tripId/shares', async (req, res, next) => {
  try {
    const userId = req.user!.userId
    const owned = await isOwner(userId, req.params.tripId)
    if (!owned) {
      const { rows: exists } = await pool.query('SELECT 1 FROM trips WHERE id = $1', [req.params.tripId])
      if (!exists.length) return res.status(404).json({ error: 'Trip not found' })
      return res.status(403).json({ error: 'Forbidden' })
    }
    const { rows } = await pool.query(
      `SELECT u.id as "userId", u.email, u.username
       FROM trip_shares ts
       JOIN users u ON u.id = ts.user_id
       WHERE ts.trip_id = $1`,
      [req.params.tripId]
    )
    res.json(rows)
  } catch (err) { next(err) }
})

// POST /trips/:tripId/shares — add collaborator by email (owner only)
tripsRouter.post('/:tripId/shares', async (req, res, next) => {
  try {
    const userId = req.user!.userId
    const owned = await isOwner(userId, req.params.tripId)
    if (!owned) {
      const { rows: exists } = await pool.query('SELECT 1 FROM trips WHERE id = $1', [req.params.tripId])
      if (!exists.length) return res.status(404).json({ error: 'Trip not found' })
      return res.status(403).json({ error: 'Forbidden' })
    }
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'email required' })
    const { rows: userRows } = await pool.query('SELECT id, email, username FROM users WHERE email = $1', [email])
    if (!userRows[0]) return res.status(404).json({ error: 'User not found' })
    const targetUser = userRows[0]
    if (targetUser.id === userId) return res.status(400).json({ error: 'Cannot share with yourself' })
    // Insert, ignore duplicate
    await pool.query(
      'INSERT INTO trip_shares (trip_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.tripId, targetUser.id]
    )
    res.status(201).json({ userId: targetUser.id, email: targetUser.email, username: targetUser.username })
  } catch (err) { next(err) }
})

// DELETE /trips/:tripId/shares/:userId — remove collaborator (owner only)
tripsRouter.delete('/:tripId/shares/:userId', async (req, res, next) => {
  try {
    const userId = req.user!.userId
    const owned = await isOwner(userId, req.params.tripId)
    if (!owned) {
      const { rows: exists } = await pool.query('SELECT 1 FROM trips WHERE id = $1', [req.params.tripId])
      if (!exists.length) return res.status(404).json({ error: 'Trip not found' })
      return res.status(403).json({ error: 'Forbidden' })
    }
    await pool.query(
      'DELETE FROM trip_shares WHERE trip_id = $1 AND user_id = $2',
      [req.params.tripId, req.params.userId]
    )
    res.status(204).send()
  } catch (err) { next(err) }
})

// --- Internal helpers ---

async function getFlightsForTrip(tripId: string) {
  const { rows: flights } = await pool.query(
    'SELECT f.*, a.name as airplane_name, a.cruise_tas_kts, a.fuel_consumption, a.fuel_unit FROM flights f LEFT JOIN airplanes a ON a.id = f.airplane_id WHERE f.trip_id = $1 ORDER BY f.sort_order',
    [tripId]
  )
  const result = []
  for (const f of flights) {
    const legs = await getLegsForFlight(f.id)
    result.push({ ...camelizeRow(f), legs })
  }
  return result
}

async function getLegsForFlight(flightId: string) {
  const { rows } = await pool.query(`
    SELECT l.*,
      json_build_object('id', dw.id, 'name', dw.name, 'icaoCode', dw.icao_code, 'waypointType', dw.waypoint_type,
        'lat', ST_Y(dw.location::geometry), 'lon', ST_X(dw.location::geometry), 'elevationFt', dw.elevation_ft) as departure,
      json_build_object('id', aw.id, 'name', aw.name, 'icaoCode', aw.icao_code, 'waypointType', aw.waypoint_type,
        'lat', ST_Y(aw.location::geometry), 'lon', ST_X(aw.location::geometry), 'elevationFt', aw.elevation_ft) as arrival
    FROM legs l
    JOIN waypoints dw ON dw.id = l.departure_id
    JOIN waypoints aw ON aw.id = l.arrival_id
    WHERE l.flight_id = $1
    ORDER BY l.sort_order
  `, [flightId])

  const result = []
  for (const leg of rows) {
    const { rows: iwRows } = await pool.query(`
      SELECT w.id, w.name, w.icao_code as "icaoCode", w.waypoint_type as "waypointType",
        ST_Y(w.location::geometry) as lat, ST_X(w.location::geometry) as lon, w.elevation_ft as "elevationFt"
      FROM leg_waypoints lw
      JOIN waypoints w ON w.id = lw.waypoint_id
      WHERE lw.leg_id = $1
      ORDER BY lw.sort_order
    `, [leg.id])
    result.push({
      id: leg.id, flightId: leg.flight_id, sortOrder: leg.sort_order,
      name: leg.name, departure: leg.departure, arrival: leg.arrival,
      intermediates: iwRows, color: leg.color, notes: leg.notes,
      visible: leg.visible, altitudeProfile: leg.altitude_profile ?? [],
      createdAt: leg.created_at, updatedAt: leg.updated_at
    })
  }
  return result
}

function camelizeRow(row: Record<string, unknown>) {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    result[camel] = row[key]
  }
  return result
}
