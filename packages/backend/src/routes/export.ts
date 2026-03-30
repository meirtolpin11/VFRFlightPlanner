import { Router } from 'express'
import { pool } from '../db/pool'
import { generateGpx, generatePln, generateFpl } from '../services/exportService'
import { Leg } from '@flight-planner/shared'

export const exportRouter = Router()

async function getLeg(legId: string): Promise<Leg | null> {
  const { rows } = await pool.query(`
    SELECT l.*,
      json_build_object('id', dw.id, 'name', dw.name, 'icaoCode', dw.icao_code,
        'lat', ST_Y(dw.location::geometry), 'lon', ST_X(dw.location::geometry),
        'elevationFt', dw.elevation_ft, 'waypointType', dw.waypoint_type, 'isCustom', dw.is_custom) as departure,
      json_build_object('id', aw.id, 'name', aw.name, 'icaoCode', aw.icao_code,
        'lat', ST_Y(aw.location::geometry), 'lon', ST_X(aw.location::geometry),
        'elevationFt', aw.elevation_ft, 'waypointType', aw.waypoint_type, 'isCustom', aw.is_custom) as arrival
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
    FROM leg_waypoints lw JOIN waypoints w ON w.id = lw.waypoint_id
    WHERE lw.leg_id = $1 ORDER BY lw.sort_order
  `, [legId])
  return {
    id: leg.id, flightId: leg.flight_id, sortOrder: leg.sort_order,
    name: leg.name, departure: leg.departure, arrival: leg.arrival,
    intermediates: iwRows, color: leg.color, notes: leg.notes,
    createdAt: leg.created_at, updatedAt: leg.updated_at
  } as Leg
}

exportRouter.get('/legs/:legId/export/gpx', async (req, res, next) => {
  try {
    const leg = await getLeg(req.params.legId)
    if (!leg) return res.status(404).json({ error: 'Leg not found' })
    const filename = `${(leg.name || 'flight').replace(/[^a-z0-9]/gi, '_')}.gpx`
    res.setHeader('Content-Type', 'application/gpx+xml')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(generateGpx(leg))
  } catch (err) { next(err) }
})

exportRouter.get('/legs/:legId/export/pln', async (req, res, next) => {
  try {
    const leg = await getLeg(req.params.legId)
    if (!leg) return res.status(404).json({ error: 'Leg not found' })
    const filename = `${(leg.name || 'flight').replace(/[^a-z0-9]/gi, '_')}.pln`
    res.setHeader('Content-Type', 'application/xml')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(generatePln(leg))
  } catch (err) { next(err) }
})

exportRouter.get('/legs/:legId/export/fpl', async (req, res, next) => {
  try {
    const leg = await getLeg(req.params.legId)
    if (!leg) return res.status(404).json({ error: 'Leg not found' })
    const filename = `${(leg.name || 'flight').replace(/[^a-z0-9]/gi, '_')}.fpl`
    res.setHeader('Content-Type', 'application/xml')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(generateFpl(leg))
  } catch (err) { next(err) }
})
