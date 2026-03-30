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
