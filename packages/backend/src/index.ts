import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { tripsRouter } from './routes/trips'
import { flightsRouter } from './routes/flights'
import { legsRouter } from './routes/legs'
import { waypointsRouter } from './routes/waypoints'
import { airplanesRouter } from './routes/airplanes'
import { markersRouter } from './routes/markers'
import { mapRouter } from './routes/map'
import { exportRouter } from './routes/export'
import { wxRouter } from './routes/wx'
import { authRouter } from './routes/auth'
import { adminRouter } from './routes/admin'
import { errorHandler } from './middleware/errorHandler'
import { requireAuth } from './middleware/auth'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())
app.use(cookieParser())

app.get('/api/v1/health', async (_req, res) => {
  try {
    const { pool } = await import('./db/pool')
    await pool.query('SELECT 1')
    res.json({ status: 'ok', db: 'connected' })
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' })
  }
})

app.use('/api/v1/auth', authRouter)
app.use('/api/v1/admin', adminRouter)

app.use('/api/v1/trips', requireAuth, tripsRouter)
app.use('/api/v1', requireAuth, flightsRouter)
app.use('/api/v1', requireAuth, legsRouter)
app.use('/api/v1/waypoints', requireAuth, waypointsRouter)
app.use('/api/v1/airplanes', requireAuth, airplanesRouter)
app.use('/api/v1/markers', requireAuth, markersRouter)
app.use('/api/v1/map', requireAuth, mapRouter)
app.use('/api/v1', requireAuth, exportRouter)
app.use('/api/v1/wx', requireAuth, wxRouter)

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
})
