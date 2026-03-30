import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  const migrationsDir = path.join(__dirname, 'migrations')
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  for (const file of files) {
    const { rows } = await pool.query('SELECT filename FROM schema_migrations WHERE filename = $1', [file])
    if (rows.length > 0) {
      console.log(`Skipping already-applied migration: ${file}`)
      continue
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    console.log(`Applying migration: ${file}`)
    await pool.query(sql)
    await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
    console.log(`Applied: ${file}`)
  }

  await pool.end()
  console.log('Migrations complete')
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
