import { Router } from 'express'
import { pool } from '../db/pool'

export const waypointsRouter = Router()

waypointsRouter.get('/search', async (req, res, next) => {
  try {
    const { q, type } = req.query
    if (!q || String(q).length < 2) return res.json([])
    const pattern = `%${q}%`

    // Saved waypoints (custom points, coordinates already used in legs)
    const { rows: wRows } = await pool.query(`
      SELECT id::text as id, name, icao_code as "icaoCode", waypoint_type as "waypointType",
        ST_Y(location::geometry) as lat, ST_X(location::geometry) as lon,
        elevation_ft as "elevationFt", is_custom as "isCustom", created_at as "createdAt",
        NULL as "oaipId"
      FROM waypoints
      WHERE (name ILIKE $1 OR icao_code ILIKE $1)
        ${type ? `AND waypoint_type = '${type}'` : ''}
      LIMIT 30
    `, [pattern])

    // OAIP airports cache — exclude any already materialised in waypoints
    const { rows: aRows } = type && type !== 'airport' ? { rows: [] } : await pool.query(`
      SELECT a.oaip_id as id, a.name, a.icao_code as "icaoCode", 'airport' as "waypointType",
        ST_Y(a.location::geometry) as lat, ST_X(a.location::geometry) as lon,
        a.elevation_ft as "elevationFt", false as "isCustom", a.cached_at as "createdAt",
        a.oaip_id as "oaipId"
      FROM oaip_airports a
      WHERE (a.name ILIKE $1 OR a.icao_code ILIKE $1)
        AND NOT EXISTS (
          SELECT 1 FROM waypoints w WHERE w.icao_code = a.icao_code AND w.waypoint_type = 'airport'
        )
      LIMIT 30
    `, [pattern])

    // OAIP navaids — skip if filtering by airport type
    const shouldSearchNavaids = !type || type === 'vor' || type === 'ndb'
    const { rows: nRows } = shouldSearchNavaids ? await pool.query(`
      SELECT n.oaip_id as id, n.name,
        n.ident as "icaoCode",
        CASE WHEN n.navaid_type IN (3,4,5) THEN 'vor' ELSE 'ndb' END as "waypointType",
        ST_Y(n.location::geometry) as lat, ST_X(n.location::geometry) as lon,
        NULL::integer as "elevationFt", false as "isCustom", n.cached_at as "createdAt",
        NULL as "oaipId",
        n.oaip_id as "oaipNavaidId",
        n.frequency
      FROM oaip_navaids n
      WHERE (n.name ILIKE $1 OR n.ident ILIKE $1)
        AND NOT EXISTS (
          SELECT 1 FROM waypoints w WHERE w.name = n.name AND w.waypoint_type IN ('vor','ndb')
        )
      LIMIT 20
    `, [pattern]) : { rows: [] }

    res.json([...wRows, ...aRows, ...nRows].slice(0, 50))
  } catch (err) { next(err) }
})

waypointsRouter.get('/custom', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, icao_code as "icaoCode", waypoint_type as "waypointType",
        ST_Y(location::geometry) as lat, ST_X(location::geometry) as lon,
        elevation_ft as "elevationFt", is_custom as "isCustom", created_at as "createdAt"
      FROM waypoints WHERE is_custom = TRUE ORDER BY name
    `)
    res.json(rows)
  } catch (err) { next(err) }
})

waypointsRouter.post('/', async (req, res, next) => {
  try {
    const { name, icaoCode, waypointType, lat, lon, elevationFt, notes } = req.body
    if (!name || lat == null || lon == null) return res.status(400).json({ error: 'name, lat, lon required' })
    const { rows } = await pool.query(
      'INSERT INTO waypoints (name, icao_code, waypoint_type, location, elevation_ft, notes, is_custom) VALUES ($1, $2, $3, ST_MakePoint($4, $5)::geography, $6, $7, TRUE) RETURNING *',
      [name, icaoCode || null, waypointType || 'custom', lon, lat, elevationFt || null, notes || null]
    )
    const w = rows[0]
    res.status(201).json({
      id: w.id, name: w.name, icaoCode: w.icao_code, waypointType: w.waypoint_type,
      lat, lon, elevationFt: w.elevation_ft, isCustom: true, createdAt: w.created_at
    })
  } catch (err) { next(err) }
})

waypointsRouter.put('/:id', async (req, res, next) => {
  try {
    const { name, notes, elevationFt } = req.body
    await pool.query(
      'UPDATE waypoints SET name = COALESCE($1, name), notes = COALESCE($2, notes), elevation_ft = COALESCE($3, elevation_ft) WHERE id = $4 AND is_custom = TRUE',
      [name, notes, elevationFt, req.params.id]
    )
    res.json({ success: true })
  } catch (err) { next(err) }
})

waypointsRouter.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM waypoints WHERE id = $1 AND is_custom = TRUE', [req.params.id])
    res.status(204).send()
  } catch (err) { next(err) }
})
