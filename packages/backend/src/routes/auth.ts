import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { pool } from '../db/pool'
import { requireAuth, JWT_SECRET, COOKIE_NAME } from '../middleware/auth'

export const authRouter = Router()

const BCRYPT_ROUNDS = 12
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000 // 30 days in ms

function setAuthCookie(res: import('express').Response, userId: string, role: string) {
  const token = jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '30d' })
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
  })
}

authRouter.post('/register', async (req, res, next) => {
  try {
    const { email, username, password } = req.body
    if (!email || !username || !password) {
      return res.status(400).json({ error: 'email, username, and password are required' })
    }

    // Check if this is the first user ever
    const { rows: countRows } = await pool.query('SELECT COUNT(*) as count FROM users')
    const isFirstUser = parseInt(countRows[0].count, 10) === 0

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const role = isFirstUser ? 'admin' : 'user'
    const approved = isFirstUser

    const { rows } = await pool.query(
      'INSERT INTO users (email, username, password_hash, role, approved) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, username, role, approved, created_at',
      [email, username, passwordHash, role, approved]
    )
    const user = rows[0]

    if (approved) {
      setAuthCookie(res, user.id, user.role)
    }

    res.status(201).json({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      approved: user.approved,
    })
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' })
    next(err)
  }
})

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' })

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    const user = rows[0]
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    if (!user.approved) return res.status(403).json({ error: 'Account pending approval' })

    setAuthCookie(res, user.id, user.role)

    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      approved: user.approved,
    })
  } catch (err) { next(err) }
})

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME)
  res.json({ ok: true })
})

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, username, role, approved, created_at FROM users WHERE id = $1',
      [req.user!.userId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'User not found' })
    res.json(rows[0])
  } catch (err) { next(err) }
})
