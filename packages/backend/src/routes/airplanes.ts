import { Router } from 'express'
import { pool } from '../db/pool'

export const airplanesRouter = Router()

const camelize = (row: Record<string, unknown>) => {
  const r: Record<string, unknown> = {}
  for (const k of Object.keys(row)) r[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = row[k]
  return r
}

airplanesRouter.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM airplanes ORDER BY name')
    res.json(rows.map(camelize))
  } catch (err) { next(err) }
})

airplanesRouter.post('/', async (req, res, next) => {
  try {
    const { name, registration, cruiseTasKts, fuelConsumption, fuelUnit, notes } = req.body
    if (!name || !cruiseTasKts || !fuelConsumption || !fuelUnit) return res.status(400).json({ error: 'name, cruiseTasKts, fuelConsumption, fuelUnit required' })
    const { rows } = await pool.query(
      'INSERT INTO airplanes (name, registration, cruise_tas_kts, fuel_consumption, fuel_unit, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, registration || null, cruiseTasKts, fuelConsumption, fuelUnit, notes || null]
    )
    res.status(201).json(camelize(rows[0]))
  } catch (err) { next(err) }
})

airplanesRouter.put('/:id', async (req, res, next) => {
  try {
    const { name, registration, cruiseTasKts, fuelConsumption, fuelUnit, notes } = req.body
    const { rows } = await pool.query(`
      UPDATE airplanes SET
        name = COALESCE($1, name), registration = COALESCE($2, registration),
        cruise_tas_kts = COALESCE($3, cruise_tas_kts), fuel_consumption = COALESCE($4, fuel_consumption),
        fuel_unit = COALESCE($5, fuel_unit), notes = COALESCE($6, notes), updated_at = NOW()
      WHERE id = $7 RETURNING *
    `, [name, registration, cruiseTasKts, fuelConsumption, fuelUnit, notes, req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Airplane not found' })
    res.json(camelize(rows[0]))
  } catch (err) { next(err) }
})

airplanesRouter.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM airplanes WHERE id = $1', [req.params.id])
    res.status(204).send()
  } catch (err) { next(err) }
})
