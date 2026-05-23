import { Pool, PoolClient, QueryResult } from 'pg'
import { config } from '../config'

export interface Database {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>
  getClient(): Promise<PoolClient>
  end(): Promise<void>
}

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
})

pool.on('error', (err) => {
  console.error('Unexpected pg pool error', err)
})

export const db: Database = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  end: () => pool.end(),
}
