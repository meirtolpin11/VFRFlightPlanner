import { Router } from 'express'
import { pool } from '../db/pool'

export const markersRouter = Router()

markersRouter.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT cm.*, w.name as waypoint_name,
        ST_Y(w.location::geometry) as lat, ST_X(w.location::geometry) as lon
      FROM custom_markers cm JOIN waypoints w ON w.id = cm.waypoint_id ORDER BY cm.created_at
    `)
    res.json(rows.map(r => ({
      id: r.id, waypointId: r.waypoint_id, label: r.label,
      markerType: r.marker_type, color: r.color, createdAt: r.created_at,
      waypointName: r.waypoint_name, lat: r.lat, lon: r.lon
    })))
  } catch (err) { next(err) }
})

markersRouter.post('/', async (req, res, next) => {
  try {
    const { waypointId, label, markerType, color } = req.body
    if (!waypointId || !label || !markerType) return res.status(400).json({ error: 'waypointId, label, markerType required' })
    const { rows } = await pool.query(
      'INSERT INTO custom_markers (waypoint_id, label, marker_type, color) VALUES ($1, $2, $3, $4) RETURNING *',
      [waypointId, label, markerType, color || null]
    )
    res.status(201).json({ id: rows[0].id, waypointId, label, markerType, color, createdAt: rows[0].created_at })
  } catch (err) { next(err) }
})

markersRouter.put('/:id', async (req, res, next) => {
  try {
    const { label, markerType, color } = req.body
    await pool.query(
      'UPDATE custom_markers SET label = COALESCE($1, label), marker_type = COALESCE($2, marker_type), color = COALESCE($3, color) WHERE id = $4',
      [label, markerType, color, req.params.id]
    )
    res.json({ success: true })
  } catch (err) { next(err) }
})

markersRouter.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM custom_markers WHERE id = $1', [req.params.id])
    res.status(204).send()
  } catch (err) { next(err) }
})
