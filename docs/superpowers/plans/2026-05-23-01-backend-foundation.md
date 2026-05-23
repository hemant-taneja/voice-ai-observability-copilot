# Voice AI Copilot — Plan 1: Backend Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the monorepo, spin up infrastructure via Docker Compose, create all 6 Postgres tables via migrations, and wire a typed Express app with auth and error-handling middleware — all verified by tests.

**Architecture:** Monorepo with `backend/` and `frontend/` workspaces. Backend is Express + TypeScript with a pg connection pool, Zod config validation, HMAC-aware GHL auth middleware, and a central error handler. Temporal, Redis, and Postgres run via Docker Compose.

**Tech Stack:** Node.js 20, TypeScript 5, Express 4, pg, Zod, Jest, Supertest, Docker Compose

---

## Task 1: Initialize monorepo

**Files:**
- Create: `voice-ai-copilot/package.json`
- Create: `voice-ai-copilot/.gitignore`
- Create: `voice-ai-copilot/.env.example`
- Create: `voice-ai-copilot/.env`

- [ ] **Step 1: Create the project root inside the repo**

```bash
mkdir -p C:/Development/Redacted/HighLevel/voice-ai-copilot
cd C:/Development/Redacted/HighLevel/voice-ai-copilot
```

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "voice-ai-copilot",
  "private": true,
  "workspaces": ["backend", "frontend"],
  "scripts": {
    "dev": "concurrently \"npm run dev -w backend\" \"npm run dev -w frontend\"",
    "test": "npm run test -w backend && npm run test -w frontend"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

- [ ] **Step 3: Create `.env.example`**

```
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/voice_copilot

# Redis
REDIS_URL=redis://localhost:6379

# Temporal
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default

# GHL
GHL_CLIENT_ID=
GHL_CLIENT_SECRET=
GHL_WEBHOOK_SECRET=your-webhook-secret-here

# LLM
LLM_PROVIDER=openai
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# App
PORT=3000
NODE_ENV=development
VITE_API_BASE_URL=http://localhost:3000
```

- [ ] **Step 4: Copy to `.env` and fill in your API keys**

```bash
cp .env.example .env
```

- [ ] **Step 5: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/
git commit -m "chore: initialize voice-ai-copilot monorepo scaffold"
git push
```

---

## Task 2: Backend TypeScript + package setup

**Files:**
- Create: `voice-ai-copilot/backend/package.json`
- Create: `voice-ai-copilot/backend/tsconfig.json`
- Create: `voice-ai-copilot/backend/jest.config.ts`

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "@voice-ai-copilot/backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest --runInBand",
    "test:watch": "jest --watch --runInBand",
    "migrate": "ts-node src/db/migrate.ts",
    "seed": "ts-node src/db/seed.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.24.3",
    "@temporalio/activity": "^1.10.2",
    "@temporalio/client": "^1.10.2",
    "@temporalio/worker": "^1.10.2",
    "@temporalio/workflow": "^1.10.2",
    "axios": "^1.7.2",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "helmet": "^7.1.0",
    "openai": "^4.52.7",
    "pg": "^8.12.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.14.10",
    "@types/pg": "^8.11.6",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.2",
    "ts-node": "^10.9.2",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.5.3"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd voice-ai-copilot/backend
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 4: Create `backend/jest.config.ts`**

```typescript
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/server.ts',
    '!src/db/seed.ts',
    '!src/db/migrate.ts',
  ],
}

export default config
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
mkdir -p src && echo "export {}" > src/smoke.ts
npx tsc --noEmit
rm src/smoke.ts
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/backend/
git commit -m "chore: backend typescript, jest, and package setup"
git push
```

---

## Task 3: Config validation

**Files:**
- Create: `backend/src/config.ts`
- Create: `backend/src/config.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/config.test.ts
describe('config', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  function setValidEnv() {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/voice_copilot'
    process.env.REDIS_URL = 'redis://localhost:6379'
    process.env.TEMPORAL_ADDRESS = 'localhost:7233'
    process.env.GHL_WEBHOOK_SECRET = 'test-secret'
    process.env.LLM_PROVIDER = 'openai'
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.NODE_ENV = 'test'
  }

  it('loads valid config without throwing', () => {
    setValidEnv()
    expect(() => require('./config')).not.toThrow()
  })

  it('throws when DATABASE_URL is missing', () => {
    setValidEnv()
    delete process.env.DATABASE_URL
    expect(() => require('./config')).toThrow()
  })

  it('throws when LLM_PROVIDER is not openai or anthropic', () => {
    setValidEnv()
    process.env.LLM_PROVIDER = 'grok'
    expect(() => require('./config')).toThrow()
  })

  it('throws when GHL_WEBHOOK_SECRET is missing', () => {
    setValidEnv()
    delete process.env.GHL_WEBHOOK_SECRET
    expect(() => require('./config')).toThrow()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd voice-ai-copilot/backend
npx jest src/config.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module './config'`

- [ ] **Step 3: Implement `backend/src/config.ts`**

```typescript
import { z } from 'zod'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const schema = z.object({
  databaseUrl: z.string().min(1, 'DATABASE_URL is required'),
  redisUrl: z.string().min(1, 'REDIS_URL is required'),
  temporalAddress: z.string().min(1, 'TEMPORAL_ADDRESS is required'),
  temporalNamespace: z.string().default('default'),
  ghlClientId: z.string().optional(),
  ghlClientSecret: z.string().optional(),
  ghlWebhookSecret: z.string().min(1, 'GHL_WEBHOOK_SECRET is required'),
  llmProvider: z.enum(['openai', 'anthropic']),
  openaiApiKey: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  port: z.coerce.number().default(3000),
  nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
})

const result = schema.safeParse({
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  temporalAddress: process.env.TEMPORAL_ADDRESS,
  temporalNamespace: process.env.TEMPORAL_NAMESPACE,
  ghlClientId: process.env.GHL_CLIENT_ID,
  ghlClientSecret: process.env.GHL_CLIENT_SECRET,
  ghlWebhookSecret: process.env.GHL_WEBHOOK_SECRET,
  llmProvider: process.env.LLM_PROVIDER,
  openaiApiKey: process.env.OPENAI_API_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV,
})

if (!result.success) {
  throw new Error(`Config validation failed:\n${result.error.toString()}`)
}

export const config = result.data
export type Config = typeof config
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx jest src/config.test.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/backend/src/
git commit -m "feat: zod config validation with required env var checks"
git push
```

---

## Task 4: Docker Compose infrastructure

**Files:**
- Create: `voice-ai-copilot/docker-compose.yml`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: voice_copilot
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  postgres_test:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: voice_copilot_test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5433:5432"
    volumes:
      - pgdata_test:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  temporal:
    image: temporalio/auto-setup:1.24.2
    ports:
      - "7233:7233"
    environment:
      - DB=postgres12
      - DB_PORT=5432
      - POSTGRES_USER=postgres
      - POSTGRES_PWD=postgres
      - POSTGRES_DB=temporal
      - POSTGRES_SEEDS=postgres
    depends_on:
      postgres:
        condition: service_healthy

  temporal-ui:
    image: temporalio/ui:2.26.2
    ports:
      - "8080:8080"
    environment:
      - TEMPORAL_ADDRESS=temporal:7233
    depends_on:
      - temporal

volumes:
  pgdata:
  pgdata_test:
  redisdata:
```

- [ ] **Step 2: Start Postgres and Redis (skip Temporal for now — it needs the DB seeded first)**

```bash
cd voice-ai-copilot
docker compose up -d postgres postgres_test redis
```

- [ ] **Step 3: Verify healthy**

```bash
docker compose ps
```

Expected: `postgres`, `postgres_test`, `redis` all show `running (healthy)`.

- [ ] **Step 4: Smoke-test Postgres**

```bash
docker compose exec postgres psql -U postgres -c "SELECT version();"
```

Expected: PostgreSQL 16 version string.

- [ ] **Step 5: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/docker-compose.yml
git commit -m "chore: docker compose for postgres, redis, temporal"
git push
```

---

## Task 5: Database connection pool

**Files:**
- Create: `backend/src/db/index.ts`
- Create: `backend/src/db/index.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/db/index.test.ts
// Requires postgres_test running on port 5433
import { Pool } from 'pg'

const TEST_URL = 'postgresql://postgres:postgres@localhost:5433/voice_copilot_test'

describe('db pool', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = TEST_URL
    process.env.REDIS_URL = 'redis://localhost:6379'
    process.env.TEMPORAL_ADDRESS = 'localhost:7233'
    process.env.GHL_WEBHOOK_SECRET = 'test'
    process.env.LLM_PROVIDER = 'openai'
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.NODE_ENV = 'test'
    jest.resetModules()
  })

  it('executes a simple query successfully', async () => {
    const { db } = await import('./index')
    const result = await db.query<{ sum: number }>('SELECT 1 + 1 AS sum')
    expect(result.rows[0].sum).toBe(2)
    await db.end()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx jest src/db/index.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module './index'`

- [ ] **Step 3: Create `backend/src/db/index.ts`**

```typescript
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
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx jest src/db/index.test.ts --no-coverage
```

Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/backend/src/db/
git commit -m "feat: postgres connection pool with typed query interface"
git push
```

---

## Task 6: Database migrations

**Files:**
- Create: `backend/src/db/migrations/001_initial.sql`
- Create: `backend/src/db/migrate.ts`
- Create: `backend/src/db/migrate.test.ts`

- [ ] **Step 1: Create `backend/src/db/migrations/001_initial.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS locations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      VARCHAR(255) UNIQUE NOT NULL,
  name             VARCHAR(255),
  access_token     TEXT,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  VARCHAR(255) NOT NULL REFERENCES locations(location_id) ON DELETE CASCADE,
  ghl_agent_id VARCHAR(255) NOT NULL,
  name         VARCHAR(255) NOT NULL,
  script       TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, ghl_agent_id)
);

CREATE TABLE IF NOT EXISTS kpi_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  goals             JSONB NOT NULL DEFAULT '[]',
  success_threshold DECIMAL(3,2) NOT NULL DEFAULT 0.70,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transcripts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id         UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  location_id      VARCHAR(255) NOT NULL,
  ghl_call_id      VARCHAR(255) UNIQUE NOT NULL,
  caller_phone     VARCHAR(50),
  duration_seconds INTEGER,
  status           VARCHAR(50) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'analyzed', 'analysis_failed')),
  turns            JSONB NOT NULL DEFAULT '[]',
  raw_payload      JSONB,
  ingested_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analysis_results (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id  UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  kpi_config_id  UUID NOT NULL REFERENCES kpi_configs(id),
  overall_score  DECIMAL(3,2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 1),
  passed         BOOLEAN NOT NULL,
  kpi_scores     JSONB NOT NULL DEFAULT '[]',
  summary        TEXT NOT NULL,
  llm_provider   VARCHAR(50) NOT NULL,
  llm_model      VARCHAR(100) NOT NULL,
  analyzed_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS use_actions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id           UUID NOT NULL REFERENCES analysis_results(id) ON DELETE CASCADE,
  transcript_turn_index INTEGER NOT NULL,
  type                  VARCHAR(50) NOT NULL
                        CHECK (type IN ('missed_opportunity', 'deviation', 'escalation_needed')),
  description           TEXT NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_location_id        ON agents(location_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_agent_id      ON transcripts(agent_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_status        ON transcripts(status);
CREATE INDEX IF NOT EXISTS idx_analysis_transcript_id    ON analysis_results(transcript_id);
CREATE INDEX IF NOT EXISTS idx_use_actions_analysis_id   ON use_actions(analysis_id);
```

- [ ] **Step 2: Write the failing test**

```typescript
// backend/src/db/migrate.test.ts
import { Pool } from 'pg'

const TEST_URL = 'postgresql://postgres:postgres@localhost:5433/voice_copilot_test'

describe('migrations', () => {
  let pool: Pool

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_URL
    process.env.REDIS_URL = 'redis://localhost:6379'
    process.env.TEMPORAL_ADDRESS = 'localhost:7233'
    process.env.GHL_WEBHOOK_SECRET = 'test'
    process.env.LLM_PROVIDER = 'openai'
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.NODE_ENV = 'test'
    jest.resetModules()
    pool = new Pool({ connectionString: TEST_URL })
    const { runMigrations } = await import('./migrate')
    await runMigrations(TEST_URL)
  })

  afterAll(() => pool.end())

  const tables = ['locations', 'agents', 'kpi_configs', 'transcripts', 'analysis_results', 'use_actions']

  it.each(tables)('table "%s" exists after migration', async (table) => {
    const { rows } = await pool.query(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1
       ) AS exists`,
      [table]
    )
    expect(rows[0].exists).toBe(true)
  })
})
```

- [ ] **Step 3: Run — expect FAIL**

```bash
npx jest src/db/migrate.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module './migrate'`

- [ ] **Step 4: Create `backend/src/db/migrate.ts`**

```typescript
import { Pool } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'
import { config } from '../config'

export async function runMigrations(connectionString?: string): Promise<void> {
  const pool = new Pool({ connectionString: connectionString ?? config.databaseUrl })
  try {
    const sql = readFileSync(join(__dirname, 'migrations', '001_initial.sql'), 'utf-8')
    await pool.query(sql)
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
```

- [ ] **Step 5: Run — expect PASS**

```bash
npx jest src/db/migrate.test.ts --no-coverage
```

Expected: PASS (6 tests — one per table)

- [ ] **Step 6: Run migrations on the dev database**

```bash
npx ts-node src/db/migrate.ts
```

Expected: `✓ Migrations complete`

- [ ] **Step 7: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/backend/src/db/
git commit -m "feat: database migrations — all 6 tables with indexes"
git push
```

---

## Task 7: Express app skeleton

**Files:**
- Create: `backend/src/routes/index.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/server.ts`
- Create: `backend/src/app.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/app.test.ts
import request from 'supertest'

function setTestEnv() {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/voice_copilot_test'
  process.env.REDIS_URL = 'redis://localhost:6379'
  process.env.TEMPORAL_ADDRESS = 'localhost:7233'
  process.env.GHL_WEBHOOK_SECRET = 'test-secret'
  process.env.LLM_PROVIDER = 'openai'
  process.env.OPENAI_API_KEY = 'sk-test'
  process.env.NODE_ENV = 'test'
}

describe('app', () => {
  let app: import('express').Express

  beforeAll(async () => {
    setTestEnv()
    jest.resetModules()
    const mod = await import('./app')
    app = mod.app
  })

  it('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.timestamp).toBeDefined()
  })

  it('unknown route returns 404 with error body', async () => {
    const res = await request(app).get('/not-a-real-route')
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('NOT_FOUND')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx jest src/app.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module './app'`

- [ ] **Step 3: Create `backend/src/routes/index.ts`**

```typescript
import { Router, Request, Response } from 'express'

export const router = Router()

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})
```

- [ ] **Step 4: Create `backend/src/app.ts`**

```typescript
import express, { Request, Response } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { router } from './routes/index'

export const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api', router)

// 404 — after all routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' })
})
```

- [ ] **Step 5: Create `backend/src/server.ts`**

```typescript
import { app } from './app'
import { config } from './config'

app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port} [${config.nodeEnv}]`)
})
```

- [ ] **Step 6: Run — expect PASS**

```bash
npx jest src/app.test.ts --no-coverage
```

Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/backend/src/
git commit -m "feat: express app skeleton with health endpoint and 404 handler"
git push
```

---

## Task 8: GHL auth middleware

**Files:**
- Create: `backend/src/middleware/ghl-auth.ts`
- Create: `backend/src/middleware/ghl-auth.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/middleware/ghl-auth.test.ts
import request from 'supertest'
import express, { Request, Response } from 'express'
import { Database } from '../db/index'

// Import after env is set
async function makeApp(mockDb?: Partial<Database>) {
  jest.resetModules()
  const { ghlAuth } = await import('./ghl-auth')
  const app = express()
  app.use(express.json())
  app.get('/protected', ghlAuth(mockDb as Database), (req: Request, res: Response) => {
    const ghlReq = req as Request & { ghlContext: { locationId: string } }
    res.json({ locationId: ghlReq.ghlContext.locationId })
  })
  return app
}

beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/voice_copilot_test'
  process.env.REDIS_URL = 'redis://localhost:6379'
  process.env.TEMPORAL_ADDRESS = 'localhost:7233'
  process.env.GHL_WEBHOOK_SECRET = 'test'
  process.env.LLM_PROVIDER = 'openai'
  process.env.OPENAI_API_KEY = 'sk-test'
  process.env.NODE_ENV = 'test'
})

describe('ghlAuth', () => {
  it('returns 401 when locationId is missing', async () => {
    const app = await makeApp()
    const res = await request(app).get('/protected')
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('MISSING_LOCATION_ID')
  })

  it('returns 401 when locationId is not in the database', async () => {
    const mockDb = { query: jest.fn().mockResolvedValue({ rows: [] }) }
    const app = await makeApp(mockDb)
    const res = await request(app).get('/protected?locationId=unknown')
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('UNKNOWN_LOCATION')
  })

  it('attaches ghlContext and calls next for known locationId', async () => {
    const mockDb = {
      query: jest.fn().mockResolvedValue({
        rows: [{ location_id: 'loc-abc', name: 'Agency', access_token: 'tok', refresh_token: 'ref', token_expires_at: null }],
      }),
    }
    const app = await makeApp(mockDb)
    const res = await request(app).get('/protected?locationId=loc-abc')
    expect(res.status).toBe(200)
    expect(res.body.locationId).toBe('loc-abc')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx jest src/middleware/ghl-auth.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module './ghl-auth'`

- [ ] **Step 3: Create `backend/src/middleware/ghl-auth.ts`**

```typescript
import { Request, Response, NextFunction } from 'express'
import { db as defaultDb, Database } from '../db/index'

export interface GHLContext {
  locationId: string
  name: string | null
  accessToken: string | null
  refreshToken: string | null
  tokenExpiresAt: Date | null
}

export interface GHLRequest extends Request {
  ghlContext: GHLContext
}

export function ghlAuth(dbOverride?: Database) {
  const database = dbOverride ?? defaultDb

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const locationId = (req.query.locationId ?? req.headers['x-ghl-location-id']) as string | undefined

    if (!locationId?.trim()) {
      res.status(401).json({ error: 'Missing locationId', code: 'MISSING_LOCATION_ID' })
      return
    }

    const result = await database.query(
      `SELECT location_id, name, access_token, refresh_token, token_expires_at
       FROM locations WHERE location_id = $1`,
      [locationId]
    )

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Unknown location', code: 'UNKNOWN_LOCATION' })
      return
    }

    const row = result.rows[0]
    ;(req as GHLRequest).ghlContext = {
      locationId: row.location_id,
      name: row.name,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      tokenExpiresAt: row.token_expires_at,
    }

    next()
  }
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx jest src/middleware/ghl-auth.test.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/backend/src/middleware/
git commit -m "feat: ghl-auth middleware — locationId validation against DB"
git push
```

---

## Task 9: Error handler + wire everything into app

**Files:**
- Create: `backend/src/middleware/error-handler.ts`
- Create: `backend/src/middleware/error-handler.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/middleware/error-handler.test.ts
import request from 'supertest'
import express, { Request, Response, NextFunction } from 'express'

async function makeApp(routeHandler: (req: Request, res: Response, next: NextFunction) => void) {
  jest.resetModules()
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/voice_copilot_test'
  process.env.REDIS_URL = 'redis://localhost:6379'
  process.env.TEMPORAL_ADDRESS = 'localhost:7233'
  process.env.GHL_WEBHOOK_SECRET = 'test'
  process.env.LLM_PROVIDER = 'openai'
  process.env.OPENAI_API_KEY = 'sk-test'
  process.env.NODE_ENV = 'test'
  const { errorHandler, AppError } = await import('./error-handler')
  const app = express()
  app.use(express.json())
  app.get('/test', routeHandler)
  app.use(errorHandler)
  return { app, AppError }
}

describe('errorHandler', () => {
  it('handles AppError with correct status and code', async () => {
    const { app, AppError } = await makeApp((_req, _res, next) => {
      next(new AppError('Agent not found', 404, 'AGENT_NOT_FOUND'))
    })
    const res = await request(app).get('/test')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Agent not found', code: 'AGENT_NOT_FOUND' })
  })

  it('returns 500 for unexpected errors', async () => {
    const { app } = await makeApp((_req, _res, next) => {
      next(new Error('database exploded'))
    })
    const res = await request(app).get('/test')
    expect(res.status).toBe(500)
    expect(res.body.code).toBe('INTERNAL_ERROR')
  })

  it('never exposes internal error details in response body', async () => {
    const { app } = await makeApp((_req, _res, next) => {
      next(new Error('super secret connection string is postgresql://...'))
    })
    const res = await request(app).get('/test')
    expect(JSON.stringify(res.body)).not.toContain('postgresql')
    expect(JSON.stringify(res.body)).not.toContain('secret')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx jest src/middleware/error-handler.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module './error-handler'`

- [ ] **Step 3: Create `backend/src/middleware/error-handler.ts`**

```typescript
import { Request, Response, NextFunction } from 'express'
import { config } from '../config'

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly code: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction  // 4-arg signature required by Express
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code })
    return
  }

  // Log with context, never in response
  console.error({
    message: err.message,
    path: req.path,
    method: req.method,
    locationId: req.query.locationId ?? 'unknown',
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  })

  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' })
}
```

- [ ] **Step 4: Wire error handler into `backend/src/app.ts`**

```typescript
import express, { Request, Response } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { router } from './routes/index'
import { errorHandler } from './middleware/error-handler'

export const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api', router)

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' })
})

app.use(errorHandler)
```

- [ ] **Step 5: Run all tests**

```bash
npx jest --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/backend/src/
git commit -m "feat: AppError class and central error handler wired into app"
git push
```

---

## Task 10: Makefile

**Files:**
- Create: `voice-ai-copilot/Makefile`

- [ ] **Step 1: Create `Makefile`**

```makefile
.PHONY: infra infra-down migrate seed dev test ngrok

infra:
	docker compose up -d postgres postgres_test redis temporal temporal-ui

infra-down:
	docker compose down

migrate:
	cd backend && npx ts-node src/db/migrate.ts

seed:
	cd backend && npx ts-node src/db/seed.ts

dev:
	npx concurrently \
		"cd backend && npm run dev" \
		"cd frontend && npm run dev"

test:
	cd backend && npm test
	cd frontend && npm test

ngrok:
	ngrok http 3000
```

- [ ] **Step 2: Verify migrate works end-to-end**

```bash
cd voice-ai-copilot
make infra
make migrate
```

Expected: `✓ Migrations complete`

- [ ] **Step 3: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/Makefile
git commit -m "chore: makefile for infra, migrate, seed, dev, test, ngrok"
git push
```

---

## Plan 1 Complete

**Verification — run the full backend test suite:**

```bash
cd voice-ai-copilot/backend
npm test
```

Expected: All tests pass across config, db, app, and middleware.

**What you have:**
- Full monorepo scaffold under `voice-ai-copilot/`
- TypeScript backend with Zod config validation (throws clearly on bad env)
- Docker Compose: Postgres (dev + test), Redis, Temporal + Temporal UI
- All 6 DB tables migrated with indexes and constraints
- Express app with `/health`, 404 handler
- `ghlAuth` middleware — validates `locationId` against `locations` table
- `AppError` + `errorHandler` — never leaks internals in HTTP responses
- Makefile with `infra`, `migrate`, `seed`, `dev`, `test`, `ngrok`

**Continue with:** `docs/superpowers/plans/2026-05-23-02-ghl-pipeline.md`
