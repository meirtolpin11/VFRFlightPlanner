import { Router } from 'express'
import { pool } from '../db/pool'
import { canAccessTrip } from './trips'

export const flightsRouter = Router()

flightsRouter.get('/trips/:tripId/flights', async (req, res, next) => {
  try {
    const userId = req.user!.userId
    if (!await canAccessTrip(userId, req.params.tripId)) {
      const { rows } = await pool.query('SELECT 1 FROM trips WHERE id = $1', [req.params.tripId])
      if (!rows.length) return res.status(404).json({ error: 'Trip not found' })
      return res.status(403).json({ error: 'Forbidden' })
    }
    const { rows } = await pool.query(
      'SELECT * FROM flights WHERE trip_id = $1 ORDER BY sort_order',
      [req.params.tripId]
    )
    res.json(rows.map(camelizeRow))
  } catch (err) { next(err) }
})

flightsRouter.post('/trips/:tripId/flights', async (req, res, next) => {
  try {
    const userId = req.user!.userId
    if (!await canAccessTrip(userId, req.params.tripId)) {
      const { rows } = await pool.query('SELECT 1 FROM trips WHERE id = $1', [req.params.tripId])
      if (!rows.length) return res.status(404).json({ error: 'Trip not found' })
      return res.status(403).json({ error: 'Forbidden' })
    }
    const { name, airplaneId, sortOrder } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })
    const { rows } = await pool.query(
      'INSERT INTO flights (trip_id, name, airplane_id, sort_order) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.tripId, name, airplaneId || null, sortOrder || 0]
    )
    res.status(201).json({ ...camelizeRow(rows[0]), legs: [] })
  } catch (err) { next(err) }
})

flightsRouter.put('/trips/:tripId/flights/:flightId', async (req, res, next) => {
  try {
    const userId = req.user!.userId
    if (!await canAccessTrip(userId, req.params.tripId)) {
      const { rows } = await pool.query('SELECT 1 FROM trips WHERE id = $1', [req.params.tripId])
      if (!rows.length) return res.status(404).json({ error: 'Trip not found' })
      return res.status(403).json({ error: 'Forbidden' })
    }
    const { name, airplaneId, visibleOnMap, sortOrder } = req.body
    const { rows } = await pool.query(`
      UPDATE flights SET
        name = COALESCE($1, name),
        airplane_id = CASE WHEN $2::text IS NOT NULL THEN $2::uuid ELSE airplane_id END,
        visible_on_map = COALESCE($3, visible_on_map),
        sort_order = COALESCE($4, sort_order),
        updated_at = NOW()
      WHERE id = $5 AND trip_id = $6 RETURNING *
    `, [name, airplaneId || null, visibleOnMap, sortOrder, req.params.flightId, req.params.tripId])
    if (!rows[0]) return res.status(404).json({ error: 'Flight not found' })
    res.json(camelizeRow(rows[0]))
  } catch (err) { next(err) }
})

flightsRouter.delete('/trips/:tripId/flights/:flightId', async (req, res, next) => {
  try {
    const userId = req.user!.userId
    if (!await canAccessTrip(userId, req.params.tripId)) {
      const { rows } = await pool.query('SELECT 1 FROM trips WHERE id = $1', [req.params.tripId])
      if (!rows.length) return res.status(404).json({ error: 'Trip not found' })
      return res.status(403).json({ error: 'Forbidden' })
    }
    await pool.query('DELETE FROM flights WHERE id = $1 AND trip_id = $2', [req.params.flightId, req.params.tripId])
    res.status(204).send()
  } catch (err) { next(err) }
})

function camelizeRow(row: Record<string, unknown>) {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    result[camel] = row[key]
  }
  return result
}
