import { Router } from 'express'
import { pool } from '../db/pool'
import { validateBbox } from '../middleware/validateBbox'
import { bboxToCountries, isCacheValid, refreshAirportsForCountry, refreshAirspacesForCountry, refreshReportingPointsForCountry, refreshNavaidsForCountry } from '../services/cacheService'

export const mapRouter = Router()

mapRouter.get('/airports', validateBbox, async (req, res, next) => {
  try {
    const [minLon, minLat, maxLon, maxLat] = (req.query.bbox as string).split(',').map(Number)

    // Trigger background cache refresh for uncached countries
    const countries = bboxToCountries(minLon, minLat, maxLon, maxLat)
    for (const country of countries) {
      const valid = await isCacheValid('airports', country)
      if (!valid) {
        refreshAirportsForCountry(country).catch(console.error) // background
      }
    }

    const { rows } = await pool.query(`
      SELECT a.oaip_id as id, a.icao_code as "icaoCode", a.iata_code as "iataCode",
        a.name, a.airport_type as "airportType",
        ST_Y(a.location::geometry) as lat, ST_X(a.location::geometry) as lon,
        a.elevation_ft as "elevationFt", a.country,
        COALESCE(json_agg(json_build_object(
          'id', f.id, 'frequencyType', f.frequency_type,
          'frequencyMhz', f.frequency_mhz, 'name', f.name
        )) FILTER (WHERE f.id IS NOT NULL), '[]') as frequencies
      FROM oaip_airports a
      LEFT JOIN oaip_frequencies f ON f.airport_oaip_id = a.oaip_id
      WHERE ST_Within(a.location::geometry, ST_MakeEnvelope($1, $2, $3, $4, 4326))
        AND a.airport_type NOT IN (4, 7)
      GROUP BY a.oaip_id, a.icao_code, a.iata_code, a.name, a.airport_type, a.location, a.elevation_ft, a.country
      LIMIT 500
    `, [minLon, minLat, maxLon, maxLat])

    res.json(rows)
  } catch (err) { next(err) }
})

mapRouter.get('/airports/:oaipId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.oaip_id as id, a.icao_code as "icaoCode", a.iata_code as "iataCode",
        a.name, a.airport_type as "airportType",
        ST_Y(a.location::geometry) as lat, ST_X(a.location::geometry) as lon,
        a.elevation_ft as "elevationFt", a.country,
        COALESCE(json_agg(json_build_object(
          'id', f.id, 'frequencyType', f.frequency_type,
          'frequencyMhz', f.frequency_mhz, 'name', f.name
        )) FILTER (WHERE f.id IS NOT NULL), '[]') as frequencies
      FROM oaip_airports a
      LEFT JOIN oaip_frequencies f ON f.airport_oaip_id = a.oaip_id
      WHERE a.oaip_id = $1
      GROUP BY a.oaip_id, a.icao_code, a.iata_code, a.name, a.airport_type, a.location, a.elevation_ft, a.country
    `, [req.params.oaipId])
    if (!rows[0]) return res.status(404).json({ error: 'Airport not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
})

mapRouter.get('/airspaces', validateBbox, async (req, res, next) => {
  try {
    const [minLon, minLat, maxLon, maxLat] = (req.query.bbox as string).split(',').map(Number)
    const maxAltFt = Number(req.query.max_alt_ft || 40000)

    // Background refresh
    const countries = bboxToCountries(minLon, minLat, maxLon, maxLat)
    for (const country of countries) {
      const valid = await isCacheValid('airspaces', country)
      if (!valid) {
        refreshAirspacesForCountry(country).catch(console.error) // background
      }
    }

    const { rows } = await pool.query(`
      SELECT oaip_id as id, name, airspace_class as "airspaceClass", airspace_type as "airspaceType",
        upper_limit_ft as "upperLimitFt", upper_limit_ref as "upperLimitRef",
        lower_limit_ft as "lowerLimitFt", lower_limit_ref as "lowerLimitRef",
        country,
        ST_AsGeoJSON(boundary::geometry)::json as boundary
      FROM oaip_airspaces
      WHERE upper_limit_ft <= $5
        AND ST_Intersects(boundary::geometry, ST_MakeEnvelope($1, $2, $3, $4, 4326))
      LIMIT 1000
    `, [minLon, minLat, maxLon, maxLat, maxAltFt])

    res.json(rows)
  } catch (err) { next(err) }
})

// Find or create a waypoints table entry for a given oaip airport (used for leg planning)
mapRouter.post('/airports/:oaipId/waypoint', async (req, res, next) => {
  try {
    const { rows: airportRows } = await pool.query(
      `SELECT oaip_id, icao_code, name,
        ST_Y(location::geometry) as lat, ST_X(location::geometry) as lon,
        elevation_ft FROM oaip_airports WHERE oaip_id = $1`,
      [req.params.oaipId]
    )
    if (!airportRows[0]) return res.status(404).json({ error: 'Airport not found' })
    const a = airportRows[0]

    // Try to find existing waypoint by ICAO code first
    if (a.icao_code) {
      const { rows: existing } = await pool.query(
        `SELECT id, name, icao_code as "icaoCode", waypoint_type as "waypointType",
          ST_Y(location::geometry) as lat, ST_X(location::geometry) as lon,
          elevation_ft as "elevationFt", is_custom as "isCustom", created_at as "createdAt"
        FROM waypoints WHERE icao_code = $1 AND waypoint_type = 'airport' LIMIT 1`,
        [a.icao_code]
      )
      if (existing[0]) return res.json(existing[0])
    }

    // Create new waypoint
    const { rows } = await pool.query(
      `INSERT INTO waypoints (name, icao_code, waypoint_type, location, elevation_ft, is_custom)
       VALUES ($1, $2, 'airport', ST_MakePoint($3, $4)::geography, $5, FALSE)
       RETURNING id, name, icao_code as "icaoCode", waypoint_type as "waypointType",
         $4::float as lat, $3::float as lon, elevation_ft as "elevationFt",
         is_custom as "isCustom", created_at as "createdAt"`,
      [a.name, a.icao_code || null, a.lon, a.lat, a.elevation_ft || null]
    )
    res.status(201).json(rows[0])
  } catch (err) { next(err) }
})

mapRouter.get('/reporting-points', validateBbox, async (req, res, next) => {
  try {
    const [minLon, minLat, maxLon, maxLat] = (req.query.bbox as string).split(',').map(Number)

    const countries = bboxToCountries(minLon, minLat, maxLon, maxLat)
    for (const country of countries) {
      const valid = await isCacheValid('reporting_points', country)
      if (!valid) {
        refreshReportingPointsForCountry(country).catch(console.error)
      }
    }

    const { rows } = await pool.query(`
      SELECT oaip_id as id, name, compulsory,
        ST_Y(location::geometry) as lat, ST_X(location::geometry) as lon,
        country
      FROM oaip_reporting_points
      WHERE ST_Within(location::geometry, ST_MakeEnvelope($1, $2, $3, $4, 4326))
      LIMIT 2000
    `, [minLon, minLat, maxLon, maxLat])

    res.json(rows)
  } catch (err) { next(err) }
})

mapRouter.post('/reporting-points/:oaipId/waypoint', async (req, res, next) => {
  try {
    const { rows: rpRows } = await pool.query(
      `SELECT oaip_id, name, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lon
       FROM oaip_reporting_points WHERE oaip_id = $1`,
      [req.params.oaipId]
    )
    if (!rpRows[0]) return res.status(404).json({ error: 'Reporting point not found' })
    const rp = rpRows[0]

    const { rows: existing } = await pool.query(
      `SELECT id, name, icao_code as "icaoCode", waypoint_type as "waypointType",
        ST_Y(location::geometry) as lat, ST_X(location::geometry) as lon,
        elevation_ft as "elevationFt", is_custom as "isCustom", created_at as "createdAt"
       FROM waypoints WHERE name = $1 AND waypoint_type = 'vrp' LIMIT 1`,
      [rp.name]
    )
    if (existing[0]) return res.json(existing[0])

    const { rows } = await pool.query(
      `INSERT INTO waypoints (name, waypoint_type, location, is_custom)
       VALUES ($1, 'vrp', ST_MakePoint($2, $3)::geography, FALSE)
       RETURNING id, name, icao_code as "icaoCode", waypoint_type as "waypointType",
         $3::float as lat, $2::float as lon, elevation_ft as "elevationFt",
         is_custom as "isCustom", created_at as "createdAt"`,
      [rp.name, rp.lon, rp.lat]
    )
    res.status(201).json(rows[0])
  } catch (err) { next(err) }
})

mapRouter.get('/navaids', validateBbox, async (req, res, next) => {
  try {
    const [minLon, minLat, maxLon, maxLat] = (req.query.bbox as string).split(',').map(Number)

    const countries = bboxToCountries(minLon, minLat, maxLon, maxLat)
    for (const country of countries) {
      const valid = await isCacheValid('navaids', country)
      if (!valid) {
        refreshNavaidsForCountry(country).catch(console.error)
      }
    }

    const { rows } = await pool.query(`
      SELECT oaip_id as id, name, ident, navaid_type as "navaidType",
        frequency,
        ST_Y(location::geometry) as lat, ST_X(location::geometry) as lon,
        country
      FROM oaip_navaids
      WHERE ST_Within(location::geometry, ST_MakeEnvelope($1, $2, $3, $4, 4326))
      LIMIT 2000
    `, [minLon, minLat, maxLon, maxLat])

    res.json(rows)
  } catch (err) { next(err) }
})

mapRouter.post('/navaids/:oaipId/waypoint', async (req, res, next) => {
  try {
    const { rows: nRows } = await pool.query(
      `SELECT oaip_id, name, ident, navaid_type,
        ST_Y(location::geometry) as lat, ST_X(location::geometry) as lon
       FROM oaip_navaids WHERE oaip_id = $1`,
      [req.params.oaipId]
    )
    if (!nRows[0]) return res.status(404).json({ error: 'Navaid not found' })
    const n = nRows[0]
    const wpType = [3, 4, 5].includes(n.navaid_type) ? 'vor' : 'ndb'

    const { rows: existing } = await pool.query(
      `SELECT id, name, icao_code as "icaoCode", waypoint_type as "waypointType",
        ST_Y(location::geometry) as lat, ST_X(location::geometry) as lon,
        elevation_ft as "elevationFt", is_custom as "isCustom", created_at as "createdAt"
       FROM waypoints WHERE name = $1 AND waypoint_type = $2 LIMIT 1`,
      [n.name, wpType]
    )
    if (existing[0]) return res.json(existing[0])

    const { rows } = await pool.query(
      `INSERT INTO waypoints (name, icao_code, waypoint_type, location, is_custom)
       VALUES ($1, $2, $3, ST_MakePoint($4, $5)::geography, FALSE)
       RETURNING id, name, icao_code as "icaoCode", waypoint_type as "waypointType",
         $5::float as lat, $4::float as lon, elevation_ft as "elevationFt",
         is_custom as "isCustom", created_at as "createdAt"`,
      [n.name, n.ident || null, wpType, n.lon, n.lat]
    )
    res.status(201).json(rows[0])
  } catch (err) { next(err) }
})

mapRouter.post('/refresh', async (req, res, next) => {
  try {
    const country = req.query.country as string
    if (!country) return res.status(400).json({ error: 'country required' })
    refreshAirportsForCountry(country).catch(console.error)
    refreshAirspacesForCountry(country).catch(console.error)
    res.json({ message: `Refresh triggered for ${country}` })
  } catch (err) { next(err) }
})
