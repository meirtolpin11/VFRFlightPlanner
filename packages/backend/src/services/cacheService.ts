import { pool } from '../db/pool'
import { fetchAirportsByCountry, fetchAirspacesByCountry, fetchReportingPointsByCountry, fetchNavaidsByCountry, FREQUENCY_TYPE_NAMES, AIRSPACE_CLASS_NAMES } from './openAipClient'

const TTL_AIRPORTS_HOURS = parseInt(process.env.CACHE_TTL_AIRPORTS_HOURS || '24')
const TTL_AIRSPACES_HOURS = parseInt(process.env.CACHE_TTL_AIRSPACES_HOURS || '72')

// European countries we care about
const EUROPE_COUNTRIES = [
  'AT', 'BE', 'BG', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GB', 'GR',
  'HR', 'HU', 'IE', 'IS', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO',
  'SE', 'SI', 'SK', 'AL', 'BA', 'ME', 'MK', 'RS', 'TR', 'UA', 'BY', 'MD', 'AM', 'GE'
]

function bboxToCountries(minLon: number, minLat: number, maxLon: number, maxLat: number): string[] {
  // Rough bounding boxes per country — expand if needed
  const countryBboxes: Record<string, [number, number, number, number]> = {
    'GB': [-8, 49, 2, 61], 'FR': [-5, 42, 8, 51], 'DE': [6, 47, 15, 55],
    'IT': [7, 37, 18, 47], 'ES': [-9, 36, 3, 44], 'NL': [3, 51, 7, 53],
    'BE': [3, 49, 6, 51], 'CH': [6, 46, 10, 48], 'AT': [10, 47, 17, 49],
    'PL': [14, 49, 24, 54], 'CZ': [13, 49, 19, 51], 'SK': [17, 48, 22, 49],
    'HU': [16, 46, 23, 48], 'RO': [22, 44, 30, 48], 'BG': [22, 42, 29, 44],
    'GR': [20, 35, 26, 42], 'PT': [-9, 37, -6, 42], 'SE': [11, 55, 24, 69],
    'NO': [4, 58, 31, 71], 'DK': [8, 55, 13, 58], 'FI': [20, 60, 32, 70],
    'IE': [-10, 51, -6, 55], 'HR': [14, 42, 20, 46], 'SI': [14, 46, 17, 47],
    'RS': [19, 43, 23, 46], 'BA': [16, 43, 20, 45], 'ME': [18, 42, 20, 43],
    'AL': [20, 40, 21, 42], 'MK': [21, 41, 23, 42], 'LT': [21, 54, 27, 57],
    'LV': [21, 56, 28, 58], 'EE': [22, 57, 28, 60], 'BY': [24, 51, 33, 54],
    'UA': [22, 45, 40, 52], 'TR': [26, 36, 45, 42], 'IS': [-25, 63, -13, 67],
    'CY': [32, 35, 34, 35], 'MT': [14, 35, 15, 36], 'LU': [6, 49, 6, 50],
  }

  const result: string[] = []
  for (const [country, [w, s, e, n]] of Object.entries(countryBboxes)) {
    if (maxLon >= w && minLon <= e && maxLat >= s && minLat <= n) {
      result.push(country)
    }
  }
  return result.length > 0 ? result : ['DE'] // fallback
}

async function isCacheValid(dataType: string, country: string): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT expires_at FROM cache_status WHERE data_type = $1 AND country = $2',
    [dataType, country]
  )
  if (!rows[0]) return false
  return new Date(rows[0].expires_at) > new Date()
}

export async function refreshAirportsForCountry(country: string): Promise<void> {
  console.log(`Refreshing airports cache for ${country}`)
  try {
    const airports = await fetchAirportsByCountry(country)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const airport of airports) {
        if (!airport.geometry?.coordinates) continue
        const [lon, lat] = airport.geometry.coordinates
        await client.query(`
          INSERT INTO oaip_airports (oaip_id, icao_code, iata_code, name, airport_type, location, elevation_ft, country, raw_json)
          VALUES ($1, $2, $3, $4, $5, ST_MakePoint($6, $7)::geography, $8, $9, $10)
          ON CONFLICT (oaip_id) DO UPDATE SET
            name = EXCLUDED.name, airport_type = EXCLUDED.airport_type,
            location = EXCLUDED.location, elevation_ft = EXCLUDED.elevation_ft,
            raw_json = EXCLUDED.raw_json, cached_at = NOW()
        `, [airport._id, airport.icaoCode || null, airport.iataCode || null, airport.name, airport.type,
            lon, lat, airport.elevation?.value || null, country, JSON.stringify(airport)])

        if (airport.frequencies && airport.frequencies.length > 0) {
          await client.query('DELETE FROM oaip_frequencies WHERE airport_oaip_id = $1', [airport._id])
          for (const freq of airport.frequencies) {
            await client.query(
              'INSERT INTO oaip_frequencies (airport_oaip_id, frequency_type, frequency_mhz, name, raw_json) VALUES ($1, $2, $3, $4, $5)',
              [airport._id, FREQUENCY_TYPE_NAMES[freq.type] || String(freq.type), freq.value, freq.name || null, JSON.stringify(freq)]
            )
          }
        }
      }

      const expiresAt = new Date(Date.now() + TTL_AIRPORTS_HOURS * 3600 * 1000)
      await client.query(`
        INSERT INTO cache_status (data_type, country, expires_at, record_count)
        VALUES ('airports', $1, $2, $3)
        ON CONFLICT (data_type, country) DO UPDATE SET fetched_at = NOW(), expires_at = $2, record_count = $3
      `, [country, expiresAt, airports.length])

      await client.query('COMMIT')
      console.log(`Cached ${airports.length} airports for ${country}`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`Failed to refresh airports for ${country}:`, err)
  }
}

export async function refreshAirspacesForCountry(country: string): Promise<void> {
  console.log(`Refreshing airspaces cache for ${country}`)
  try {
    const airspaces = await fetchAirspacesByCountry(country)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const airspace of airspaces) {
        if (!airspace.geometry?.coordinates) continue

        const upperFt = convertToFeet(airspace.upperLimit)
        const lowerFt = convertToFeet(airspace.lowerLimit)

        if (upperFt > 40000) continue // skip airspaces above FL400

        const geoJson = JSON.stringify(airspace.geometry)
        try {
          await client.query(`
            INSERT INTO oaip_airspaces (oaip_id, name, airspace_class, airspace_type, upper_limit_ft, upper_limit_ref, lower_limit_ft, lower_limit_ref, boundary, country, raw_json)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_GeomFromGeoJSON($9)::geography, $10, $11)
            ON CONFLICT (oaip_id) DO UPDATE SET
              name = EXCLUDED.name, airspace_class = EXCLUDED.airspace_class,
              upper_limit_ft = EXCLUDED.upper_limit_ft, lower_limit_ft = EXCLUDED.lower_limit_ft,
              boundary = EXCLUDED.boundary, raw_json = EXCLUDED.raw_json, cached_at = NOW()
          `, [airspace._id, airspace.name, AIRSPACE_CLASS_NAMES[airspace.icaoClass] || 'G',
              airspace.type, upperFt, getRef(airspace.upperLimit), lowerFt, getRef(airspace.lowerLimit),
              geoJson, country, JSON.stringify(airspace)])
        } catch (e) {
          console.warn(`Skipping invalid airspace geometry for ${airspace._id}:`, e)
        }
      }

      const expiresAt = new Date(Date.now() + TTL_AIRSPACES_HOURS * 3600 * 1000)
      await client.query(`
        INSERT INTO cache_status (data_type, country, expires_at, record_count)
        VALUES ('airspaces', $1, $2, $3)
        ON CONFLICT (data_type, country) DO UPDATE SET fetched_at = NOW(), expires_at = $2, record_count = $3
      `, [country, expiresAt, airspaces.filter(a => convertToFeet(a.upperLimit) <= 40000).length])

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`Failed to refresh airspaces for ${country}:`, err)
  }
}

function convertToFeet(limit: { value: number; unit: number; referenceDatum: number }): number {
  if (!limit) return 99999
  // referenceDatum 2 = standard pressure (FL) — value is the FL number regardless of unit field
  if (limit.referenceDatum === 2) return limit.value * 100
  // unit: 0=FL, 1=feet, 6=meters
  if (limit.unit === 0) return limit.value * 100
  if (limit.unit === 6) return Math.round(limit.value * 3.28084)
  return limit.value
}

function getRef(limit: { referenceDatum: number }): string {
  // 0=GND, 1=MSL, 2=STD
  const refs: Record<number, string> = { 0: 'AGL', 1: 'MSL', 2: 'FL' }
  return refs[limit?.referenceDatum] || 'MSL'
}

const TTL_REPORTING_POINTS_HOURS = parseInt(process.env.CACHE_TTL_AIRSPACES_HOURS || '72')

export async function refreshReportingPointsForCountry(country: string): Promise<void> {
  console.log(`Refreshing reporting points cache for ${country}`)
  try {
    const points = await fetchReportingPointsByCountry(country)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const p of points) {
        if (!p.geometry?.coordinates) continue
        const [lon, lat] = p.geometry.coordinates
        await client.query(`
          INSERT INTO oaip_reporting_points (oaip_id, name, compulsory, location, country, raw_json)
          VALUES ($1, $2, $3, ST_MakePoint($4, $5)::geography, $6, $7)
          ON CONFLICT (oaip_id) DO UPDATE SET
            name = EXCLUDED.name, compulsory = EXCLUDED.compulsory,
            location = EXCLUDED.location, raw_json = EXCLUDED.raw_json, cached_at = NOW()
        `, [p._id, p.name, p.compulsory || false, lon, lat, country, JSON.stringify(p)])
      }

      const expiresAt = new Date(Date.now() + TTL_REPORTING_POINTS_HOURS * 3600 * 1000)
      await client.query(`
        INSERT INTO cache_status (data_type, country, expires_at, record_count)
        VALUES ('reporting_points', $1, $2, $3)
        ON CONFLICT (data_type, country) DO UPDATE SET fetched_at = NOW(), expires_at = $2, record_count = $3
      `, [country, expiresAt, points.length])

      await client.query('COMMIT')
      console.log(`Cached ${points.length} reporting points for ${country}`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`Failed to refresh reporting points for ${country}:`, err)
  }
}

export async function refreshNavaidsForCountry(country: string): Promise<void> {
  console.log(`Refreshing navaids cache for ${country}`)
  try {
    const navaids = await fetchNavaidsByCountry(country)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const n of navaids) {
        if (!n.geometry?.coordinates) continue
        const [lon, lat] = n.geometry.coordinates
        const freq = n.frequency?.value ?? null
        await client.query(`
          INSERT INTO oaip_navaids (oaip_id, name, ident, navaid_type, frequency, location, country, raw_json)
          VALUES ($1, $2, $3, $4, $5, ST_MakePoint($6, $7)::geography, $8, $9)
          ON CONFLICT (oaip_id) DO UPDATE SET
            name = EXCLUDED.name, ident = EXCLUDED.ident, navaid_type = EXCLUDED.navaid_type,
            frequency = EXCLUDED.frequency, location = EXCLUDED.location,
            raw_json = EXCLUDED.raw_json, cached_at = NOW()
        `, [n._id, n.name, n.ident || null, n.type, freq, lon, lat, country, JSON.stringify(n)])
      }

      const expiresAt = new Date(Date.now() + 72 * 3600 * 1000)
      await client.query(`
        INSERT INTO cache_status (data_type, country, expires_at, record_count)
        VALUES ('navaids', $1, $2, $3)
        ON CONFLICT (data_type, country) DO UPDATE SET fetched_at = NOW(), expires_at = $2, record_count = $3
      `, [country, expiresAt, navaids.length])

      await client.query('COMMIT')
      console.log(`Cached ${navaids.length} navaids for ${country}`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`Failed to refresh navaids for ${country}:`, err)
  }
}

export { bboxToCountries, isCacheValid, EUROPE_COUNTRIES }
