import { Pool } from 'pg'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { config } from '../config'

export async function runMigrations(connectionString?: string): Promise<void> {
  const pool = new Pool({ connectionString: connectionString ?? config.databaseUrl })
  try {
    const dir = join(__dirname, 'migrations')
    // Apply every *.sql in lexicographic order (001_, 002_, ...). Adding a new
    // migration file is all that's needed — no need to register it here.
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
    for (const file of files) {
      await pool.query(readFileSync(join(dir, file), 'utf-8'))
      console.log(`  applied ${file}`)
    }
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
