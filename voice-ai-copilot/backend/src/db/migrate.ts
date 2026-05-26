import { Pool } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'
import { config } from '../config'

export async function runMigrations(connectionString?: string): Promise<void> {
  const pool = new Pool({ connectionString: connectionString ?? config.databaseUrl })
  try {
    const sql001 = readFileSync(join(__dirname, 'migrations', '001_initial.sql'), 'utf-8')
    await pool.query(sql001)
    const sql002 = readFileSync(join(__dirname, 'migrations', '002_script_suggestions.sql'), 'utf-8')
    await pool.query(sql002)
    console.log('✓ Migrations complete')
  } finally {
    await pool.end()
  }
}

if (require.main === module) {
  runMigrations().catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
}
