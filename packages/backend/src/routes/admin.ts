import { Router } from 'express'
import { pool } from '../db/pool'
import { requireAdmin } from '../middleware/auth'

export const adminRouter = Router()

adminRouter.use(requireAdmin)

adminRouter.get('/users', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, username, role, approved, created_at FROM users ORDER BY created_at ASC'
    )
    res.json(rows)
  } catch (err) { next(err) }
})

adminRouter.put('/users/:id/approve', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      'UPDATE users SET approved = TRUE WHERE id = $1 RETURNING id, email, username, role, approved',
      [_req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'User not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
})

adminRouter.put('/users/:id/unapprove', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      'UPDATE users SET approved = FALSE WHERE id = $1 RETURNING id, email, username, role, approved',
      [_req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'User not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
})

adminRouter.put('/users/:id/role', async (req, res, next) => {
  try {
    const { role } = req.body
    if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'role must be admin or user' })
    const { rows } = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, username, role, approved',
      [role, req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'User not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
})

adminRouter.delete('/users/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.user!.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' })
    }
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id])
    res.status(204).send()
  } catch (err) { next(err) }
})
