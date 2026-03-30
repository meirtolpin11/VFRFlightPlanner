import { Router } from 'express'
import { pool } from '../db/pool'
import { canAccessTrip } from './trips'

export const legsRouter = Router()

// Helper: resolve tripId from a flightId
async function getTripIdForFlight(flightId: string): Promise<string | null> {
  const { rows } = await pool.query('SELECT trip_id FROM flights WHERE id = $1', [flightId])
  return rows[0]?.trip_id ?? null
}

// Helper: resolve tripId from a legId
async function getTripIdForLeg(legId: string): Promise<string | null> {
  const { rows } = await pool.query(
    'SELECT f.trip_id FROM legs l JOIN flights f ON f.id = l.flight_id WHERE l.id = $1',
    [legId]
  )
  return rows[0]?.trip_id ?? null
}

legsRouter.get('/flights/:flightId/legs', async (req, res, next) => {
  try {
    const userId = req.user!.userId
    const tripId = await getTripIdForFlight(req.params.flightId)
    if (!tripId) return res.status(404).json({ error: 'Flight not found' })
    if (!await canAccessTrip(userId, tripId)) return res.status(403).json({ error: 'Forbidden' })
    const legs = await getLegsForFlight(req.params.flightId)
    res.json(legs)
  } catch (err) { next(err) }
})

legsRouter.post('/flights/:flightId/legs', async (req, res, next) => {
  try {
    const userId = req.user!.userId
    const tripId = await getTripIdForFlight(req.params.flightId)
    if (!tripId) return res.status(404).json({ error: 'Flight not found' })
    if (!await canAccessTrip(userId, tripId)) return res.status(403).json({ error: 'Forbidden' })

    const { name, departureId, arrivalId, intermediateIds, color, notes } = req.body
    if (!departureId || !arrivalId) return res.status(400).json({ error: 'departureId and arrivalId required' })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query(
        'INSERT INTO legs (flight_id, name, departure_id, arrival_id, color, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [req.params.flightId, name || null, departureId, arrivalId, color || '#3B82F6', notes || null]
      )
      const leg = rows[0]

      if (intermediateIds && intermediateIds.length > 0) {
        for (let i = 0; i < intermediateIds.length; i++) {
          await client.query(
            'INSERT INTO leg_waypoints (leg_id, waypoint_id, sort_order) VALUES ($1, $2, $3)',
            [leg.id, intermediateIds[i], i]
          )
        }
      }
      await client.query('COMMIT')

      const full = await getLegById(leg.id)
      res.status(201).json(full)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) { next(err) }
})

legsRouter.get('/flights/:flightId/legs/:legId', async (req, res, next) => {
  try {
    const userId = req.user!.userId
    const tripId = await getTripIdForFlight(req.params.flightId)
    if (!tripId) return res.status(404).json({ error: 'Flight not found' })
    if (!await canAccessTrip(userId, tripId)) return res.status(403).json({ error: 'Forbidden' })
    const leg = await getLegById(req.params.legId)
    if (!leg) return res.status(404).json({ error: 'Leg not found' })
    res.json(leg)
  } catch (err) { next(err) }
})

legsRouter.put('/flights/:flightId/legs/:legId', async (req, res, next) => {
  try {
    const userId = req.user!.userId
    const tripId = await getTripIdForFlight(req.params.flightId)
    if (!tripId) return res.status(404).json({ error: 'Flight not found' })
    if (!await canAccessTrip(userId, tripId)) return res.status(403).json({ error: 'Forbidden' })

    const { name, color, notes, visible, altitudeProfile } = req.body
    await pool.query(
      'UPDATE legs SET name = COALESCE($1, name), color = COALESCE($2, color), notes = COALESCE($3, notes), visible = COALESCE($4, visible), altitude_profile = COALESCE($5, altitude_profile), updated_at = NOW() WHERE id = $6',
      [name, color, notes, visible ?? null, altitudeProfile !== undefined ? JSON.stringify(altitudeProfile) : null, req.params.legId]
    )
    const leg = await getLegById(req.params.legId)
    if (!leg) return res.status(404).json({ error: 'Leg not found' })
    res.json(leg)
  } catch (err) { next(err) }
})

legsRouter.delete('/flights/:flightId/legs/:legId', async (req, res, next) => {
  try {
    const userId = req.user!.userId
    const tripId = await getTripIdForFlight(req.params.flightId)
    if (!tripId) return res.status(404).json({ error: 'Flight not found' })
    if (!await canAccessTrip(userId, tripId)) return res.status(403).json({ error: 'Forbidden' })
    await pool.query('DELETE FROM legs WHERE id = $1 AND flight_id = $2', [req.params.legId, req.params.flightId])
    res.status(204).send()
  } catch (err) { next(err) }
})

legsRouter.put('/legs/:legId/waypoints', async (req, res, next) => {
  try {
    const userId = req.user!.userId
    const tripId = await getTripIdForLeg(req.params.legId)
    if (!tripId) return res.status(404).json({ error: 'Leg not found' })
    if (!await canAccessTrip(userId, tripId)) return res.status(403).json({ error: 'Forbidden' })

    const { departureId, arrivalId, intermediates } = req.body
    if (!departureId || !arrivalId) return res.status(400).json({ error: 'departureId and arrivalId required' })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        'UPDATE legs SET departure_id = $1, arrival_id = $2, updated_at = NOW() WHERE id = $3',
        [departureId, arrivalId, req.params.legId]
      )
      await client.query('DELETE FROM leg_waypoints WHERE leg_id = $1', [req.params.legId])
      for (let i = 0; i < (intermediates || []).length; i++) {
        await client.query(
          'INSERT INTO leg_waypoints (leg_id, waypoint_id, sort_order) VALUES ($1, $2, $3)',
          [req.params.legId, intermediates[i], i]
        )
      }
      await client.query('COMMIT')
      const leg = await getLegById(req.params.legId)
      res.json(leg)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) { next(err) }
})

// Messages
legsRouter.get('/legs/:legId/messages', async (req, res, next) => {
  try {
    const userId = req.user!.userId
    const tripId = await getTripIdForLeg(req.params.legId)
    if (!tripId) return res.status(404).json({ error: 'Leg not found' })
    if (!await canAccessTrip(userId, tripId)) return res.status(403).json({ error: 'Forbidden' })
    const { rows } = await pool.query(
      'SELECT * FROM leg_messages WHERE leg_id = $1 ORDER BY created_at ASC',
      [req.params.legId]
    )
    res.json(rows.map(r => ({ id: r.id, legId: r.leg_id, authorName: r.author_name, body: r.body, createdAt: r.created_at })))
  } catch (err) { next(err) }
})

legsRouter.post('/legs/:legId/messages', async (req, res, next) => {
  try {
    const userId = req.user!.userId
    const tripId = await getTripIdForLeg(req.params.legId)
    if (!tripId) return res.status(404).json({ error: 'Leg not found' })
    if (!await canAccessTrip(userId, tripId)) return res.status(403).json({ error: 'Forbidden' })
    const { authorName, body } = req.body
    if (!authorName || !body) return res.status(400).json({ error: 'authorName and body required' })
    const { rows } = await pool.query(
      'INSERT INTO leg_messages (leg_id, author_name, body) VALUES ($1, $2, $3) RETURNING *',
      [req.params.legId, authorName, body]
    )
    const r = rows[0]
    res.status(201).json({ id: r.id, legId: r.leg_id, authorName: r.author_name, body: r.body, createdAt: r.created_at })
  } catch (err) { next(err) }
})

legsRouter.delete('/legs/:legId/messages/:messageId', async (req, res, next) => {
  try {
    const userId = req.user!.userId
    const tripId = await getTripIdForLeg(req.params.legId)
    if (!tripId) return res.status(404).json({ error: 'Leg not found' })
    if (!await canAccessTrip(userId, tripId)) return res.status(403).json({ error: 'Forbidden' })
    await pool.query('DELETE FROM leg_messages WHERE id = $1 AND leg_id = $2', [req.params.messageId, req.params.legId])
    res.status(204).send()
  } catch (err) { next(err) }
})

async function getLegById(legId: string) {
  const { rows } = await pool.query(`
    SELECT l.*,
      json_build_object('id', dw.id, 'name', dw.name, 'icaoCode', dw.icao_code, 'waypointType', dw.waypoint_type,
        'lat', ST_Y(dw.location::geometry), 'lon', ST_X(dw.location::geometry), 'elevationFt', dw.elevation_ft,
        'isCustom', dw.is_custom) as departure,
      json_build_object('id', aw.id, 'name', aw.name, 'icaoCode', aw.icao_code, 'waypointType', aw.waypoint_type,
        'lat', ST_Y(aw.location::geometry), 'lon', ST_X(aw.location::geometry), 'elevationFt', aw.elevation_ft,
        'isCustom', aw.is_custom) as arrival
    FROM legs l
    JOIN waypoints dw ON dw.id = l.departure_id
    JOIN waypoints aw ON aw.id = l.arrival_id
    WHERE l.id = $1
  `, [legId])
  if (!rows[0]) return null
  const leg = rows[0]

  const { rows: iwRows } = await pool.query(`
    SELECT w.id, w.name, w.icao_code as "icaoCode", w.waypoint_type as "waypointType",
      ST_Y(w.location::geometry) as lat, ST_X(w.location::geometry) as lon,
      w.elevation_ft as "elevationFt", w.is_custom as "isCustom"
    FROM leg_waypoints lw
    JOIN waypoints w ON w.id = lw.waypoint_id
    WHERE lw.leg_id = $1
    ORDER BY lw.sort_order
  `, [legId])

  return {
    id: leg.id, flightId: leg.flight_id, sortOrder: leg.sort_order,
    name: leg.name, departure: leg.departure, arrival: leg.arrival,
    intermediates: iwRows, color: leg.color, notes: leg.notes,
    visible: leg.visible, altitudeProfile: leg.altitude_profile ?? [],
    createdAt: leg.created_at, updatedAt: leg.updated_at
  }
}

async function getLegsForFlight(flightId: string) {
  const { rows } = await pool.query('SELECT id FROM legs WHERE flight_id = $1 ORDER BY sort_order', [flightId])
  return Promise.all(rows.map(r => getLegById(r.id)))
}
