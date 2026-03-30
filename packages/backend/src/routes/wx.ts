import { Router } from 'express'

export const wxRouter = Router()

wxRouter.get('/metar/:icao', async (req, res) => {
  const { icao } = req.params
  try {
    const r = await fetch(`https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(icao)}&format=json&hours=2`)
    const data = await r.json()
    res.json(data)
  } catch {
    res.status(502).json({ error: 'upstream fetch failed' })
  }
})

wxRouter.get('/taf/:icao', async (req, res) => {
  const { icao } = req.params
  try {
    const r = await fetch(`https://aviationweather.gov/api/data/taf?ids=${encodeURIComponent(icao)}&format=json&hours=24`)
    const data = await r.json()
    res.json(data)
  } catch {
    res.status(502).json({ error: 'upstream fetch failed' })
  }
})

wxRouter.get('/elevation', async (req, res) => {
  const { lat, lon } = req.query
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' })
  try {
    const r = await fetch(`https://api.opentopodata.org/v1/srtm90m?locations=${lat},${lon}`)
    const data = await r.json() as { results?: { elevation: number }[] }
    const meters = data.results?.[0]?.elevation
    if (meters == null) return res.status(502).json({ error: 'no elevation data' })
    res.json({ elevationFt: Math.round(meters * 3.28084) })
  } catch {
    res.status(502).json({ error: 'upstream fetch failed' })
  }
})
