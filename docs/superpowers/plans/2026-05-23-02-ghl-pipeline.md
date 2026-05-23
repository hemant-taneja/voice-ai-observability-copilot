# Voice AI Copilot — Plan 2: GHL Integration + AI Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the GHL webhook handler (with HMAC verification and idempotency), build the provider-agnostic LLM adapter, implement the Temporal workflow and all activities, and add the SSE manager — closing the loop from raw call → analysed result → live dashboard push.

**Architecture:** Webhook stores transcript instantly → enqueues Temporal workflow → workflow runs activities (load data → build prompt → call LLM → persist → broadcast SSE). All external I/O is in activities; workflow code is pure Temporal orchestration.

**Tech Stack:** Temporal SDK, OpenAI SDK, Anthropic SDK, Node crypto (HMAC), pg, Server-Sent Events

**Prerequisite:** Plan 1 complete — infra running, migrations applied, Express app wired.

---

## Task 1: Shared TypeScript types

**Files:**
- Create: `backend/src/types/ghl.types.ts`
- Create: `backend/src/types/analysis.types.ts`
- Create: `backend/src/types/llm.types.ts`

- [ ] **Step 1: Create `backend/src/types/ghl.types.ts`**

```typescript
export interface GHLTranscriptTurn {
  speaker: 'agent' | 'user'
  text: string
  timestamp_ms: number
}

export interface GHLCallCompletedPayload {
  callId: string
  locationId: string
  agentId: string
  callerPhone?: string
  durationSeconds?: number
  turns: GHLTranscriptTurn[]
}

export interface GHLAgent {
  id: string
  name: string
  script?: string
}
```

- [ ] **Step 2: Create `backend/src/types/analysis.types.ts`**

```typescript
export interface KpiGoal {
  name: string
  description: string
  weight: number  // 0–1, all weights should sum to 1
}

export interface KpiScore {
  goal: string
  score: number   // 0–1
  passed: boolean
  evidence: string
}

export interface UseActionInput {
  transcriptTurnIndex: number
  type: 'missed_opportunity' | 'deviation' | 'escalation_needed'
  description: string
}

export interface AnalysisResult {
  transcriptId: string
  kpiConfigId: string
  overallScore: number
  passed: boolean
  kpiScores: KpiScore[]
  summary: string
  useActions: UseActionInput[]
}

export interface AnalysisJobData {
  transcriptId: string
  agentId: string
  locationId: string
  kpiConfigId: string
}
```

- [ ] **Step 3: Create `backend/src/types/llm.types.ts`**

```typescript
import { GHLTranscriptTurn, KpiGoal, KpiScore, UseActionInput } from './analysis.types'

export interface AnalysisPrompt {
  agentScript: string
  turns: GHLTranscriptTurn[]
  kpiGoals: KpiGoal[]
}

export interface AnalysisOutput {
  overallScore: number
  passed: boolean
  kpiScores: KpiScore[]
  summary: string
  useActions: UseActionInput[]
}

export interface LLMProvider {
  readonly providerName: string
  readonly modelName: string
  analyze(prompt: AnalysisPrompt): Promise<AnalysisOutput>
}
```

- [ ] **Step 4: Verify types compile**

```bash
cd voice-ai-copilot/backend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/backend/src/types/
git commit -m "feat: shared TypeScript types for GHL, analysis, and LLM"
git push
```

---

## Task 2: LLM adapter — OpenAI provider

**Files:**
- Create: `backend/src/lib/llm/openai-provider.ts`
- Create: `backend/src/lib/llm/openai-provider.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/lib/llm/openai-provider.test.ts
import { OpenAIProvider } from './openai-provider'
import { AnalysisPrompt } from '../../types/llm.types'

// We mock the OpenAI client — no real API calls in unit tests
jest.mock('openai', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    })),
  }
})

const validOutput = {
  overallScore: 0.82,
  passed: true,
  kpiScores: [{ goal: 'Book Appointment', score: 0.9, passed: true, evidence: 'Agent confirmed slot at 3pm' }],
  summary: 'Agent successfully booked appointment.',
  useActions: [],
}

const prompt: AnalysisPrompt = {
  agentScript: 'You are a booking agent.',
  turns: [
    { speaker: 'agent', text: 'Hi, are you available at 3pm?', timestamp_ms: 0 },
    { speaker: 'user', text: 'Yes, works for me.', timestamp_ms: 4000 },
  ],
  kpiGoals: [{ name: 'Book Appointment', description: 'Secure a confirmed booking', weight: 1 }],
}

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider
  let mockCreate: jest.Mock

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-test'
    jest.resetModules()
    provider = new OpenAIProvider()
    // Access the mocked create method
    const OpenAI = require('openai').default
    mockCreate = new OpenAI().chat.completions.create
  })

  it('parses a valid LLM response into AnalysisOutput', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validOutput) } }],
    })
    const result = await provider.analyze(prompt)
    expect(result.overallScore).toBe(0.82)
    expect(result.passed).toBe(true)
    expect(result.kpiScores).toHaveLength(1)
  })

  it('throws when LLM returns invalid JSON', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'not json at all' } }],
    })
    await expect(provider.analyze(prompt)).rejects.toThrow()
  })

  it('throws when LLM returns JSON missing required fields', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ overallScore: 0.5 }) } }],
    })
    await expect(provider.analyze(prompt)).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd voice-ai-copilot/backend
npx jest src/lib/llm/openai-provider.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module './openai-provider'`

- [ ] **Step 3: Create `backend/src/lib/llm/openai-provider.ts`**

```typescript
import OpenAI from 'openai'
import { z } from 'zod'
import { LLMProvider, AnalysisPrompt, AnalysisOutput } from '../../types/llm.types'

const outputSchema = z.object({
  overallScore: z.number().min(0).max(1),
  passed: z.boolean(),
  kpiScores: z.array(z.object({
    goal: z.string(),
    score: z.number().min(0).max(1),
    passed: z.boolean(),
    evidence: z.string(),
  })),
  summary: z.string(),
  useActions: z.array(z.object({
    transcriptTurnIndex: z.number().int().min(0),
    type: z.enum(['missed_opportunity', 'deviation', 'escalation_needed']),
    description: z.string(),
  })),
})

function buildSystemPrompt(prompt: AnalysisPrompt): string {
  const goals = prompt.kpiGoals
    .map((g, i) => `${i + 1}. ${g.name} (weight: ${g.weight}): ${g.description}`)
    .join('\n')

  return `You are a Voice AI call quality analyst. Evaluate the following call transcript against the agent's KPIs.

Agent Script/Goal:
${prompt.agentScript}

KPI Goals to evaluate:
${goals}

Return ONLY a JSON object matching this exact structure — no markdown, no explanation:
{
  "overallScore": <number 0-1>,
  "passed": <boolean>,
  "kpiScores": [{ "goal": "<name>", "score": <0-1>, "passed": <boolean>, "evidence": "<quote or reason>" }],
  "summary": "<2-3 sentence call summary>",
  "useActions": [{ "transcriptTurnIndex": <int>, "type": "<missed_opportunity|deviation|escalation_needed>", "description": "<what happened and why it matters>" }]
}`
}

function buildUserPrompt(prompt: AnalysisPrompt): string {
  const turns = prompt.turns
    .map((t, i) => `[${i}] ${t.speaker.toUpperCase()}: ${t.text}`)
    .join('\n')
  return `Transcript:\n${turns}`
}

export class OpenAIProvider implements LLMProvider {
  readonly providerName = 'openai'
  readonly modelName = 'gpt-4o'

  private client: OpenAI

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }

  async analyze(prompt: AnalysisPrompt): Promise<AnalysisOutput> {
    const response = await this.client.chat.completions.create({
      model: this.modelName,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt(prompt) },
        { role: 'user', content: buildUserPrompt(prompt) },
      ],
      temperature: 0.2,
    })

    const raw = response.choices[0]?.message?.content
    if (!raw) throw new Error('OpenAI returned empty content')

    const parsed = outputSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      throw new Error(`LLM output failed validation: ${parsed.error.toString()}`)
    }

    return parsed.data
  }
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx jest src/lib/llm/openai-provider.test.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/backend/src/lib/
git commit -m "feat: OpenAI LLM provider with Zod output validation"
git push
```

---

## Task 3: LLM adapter — Anthropic provider + factory

**Files:**
- Create: `backend/src/lib/llm/anthropic-provider.ts`
- Create: `backend/src/lib/llm/anthropic-provider.test.ts`
- Create: `backend/src/lib/llm/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/lib/llm/anthropic-provider.test.ts
import { AnthropicProvider } from './anthropic-provider'
import { AnalysisPrompt } from '../../types/llm.types'

jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: { create: jest.fn() },
  })),
}))

const validOutput = {
  overallScore: 0.55,
  passed: false,
  kpiScores: [{ goal: 'Qualify Lead', score: 0.55, passed: false, evidence: 'Budget not confirmed' }],
  summary: 'Agent failed to qualify the lead properly.',
  useActions: [{ transcriptTurnIndex: 3, type: 'missed_opportunity', description: 'Did not ask about budget' }],
}

const prompt: AnalysisPrompt = {
  agentScript: 'Qualify leads by confirming budget and need.',
  turns: [{ speaker: 'agent', text: 'Are you interested?', timestamp_ms: 0 }],
  kpiGoals: [{ name: 'Qualify Lead', description: 'Confirm budget and need', weight: 1 }],
}

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider
  let mockCreate: jest.Mock

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    jest.resetModules()
    provider = new AnthropicProvider()
    const Anthropic = require('@anthropic-ai/sdk').default
    mockCreate = new Anthropic().messages.create
  })

  it('parses valid Anthropic response into AnalysisOutput', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(validOutput) }],
    })
    const result = await provider.analyze(prompt)
    expect(result.overallScore).toBe(0.55)
    expect(result.passed).toBe(false)
    expect(result.useActions).toHaveLength(1)
  })

  it('throws on invalid JSON from Anthropic', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'oops' }] })
    await expect(provider.analyze(prompt)).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx jest src/lib/llm/anthropic-provider.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module './anthropic-provider'`

- [ ] **Step 3: Create `backend/src/lib/llm/anthropic-provider.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { LLMProvider, AnalysisPrompt, AnalysisOutput } from '../../types/llm.types'

const outputSchema = z.object({
  overallScore: z.number().min(0).max(1),
  passed: z.boolean(),
  kpiScores: z.array(z.object({
    goal: z.string(),
    score: z.number().min(0).max(1),
    passed: z.boolean(),
    evidence: z.string(),
  })),
  summary: z.string(),
  useActions: z.array(z.object({
    transcriptTurnIndex: z.number().int().min(0),
    type: z.enum(['missed_opportunity', 'deviation', 'escalation_needed']),
    description: z.string(),
  })),
})

export class AnthropicProvider implements LLMProvider {
  readonly providerName = 'anthropic'
  readonly modelName = 'claude-3-5-haiku-20241022'

  private client: Anthropic

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }

  async analyze(prompt: AnalysisPrompt): Promise<AnalysisOutput> {
    const goals = prompt.kpiGoals
      .map((g, i) => `${i + 1}. ${g.name} (weight: ${g.weight}): ${g.description}`)
      .join('\n')

    const turns = prompt.turns
      .map((t, i) => `[${i}] ${t.speaker.toUpperCase()}: ${t.text}`)
      .join('\n')

    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are a Voice AI call quality analyst. Evaluate this transcript against the agent KPIs.

Agent Script: ${prompt.agentScript}

KPIs:
${goals}

Transcript:
${turns}

Return ONLY valid JSON with keys: overallScore, passed, kpiScores, summary, useActions. No markdown.`,
      }],
    })

    const block = response.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') throw new Error('Anthropic returned no text block')

    const parsed = outputSchema.safeParse(JSON.parse(block.text))
    if (!parsed.success) {
      throw new Error(`LLM output failed validation: ${parsed.error.toString()}`)
    }

    return parsed.data
  }
}
```

- [ ] **Step 4: Create `backend/src/lib/llm/index.ts` (factory)**

```typescript
import { LLMProvider } from '../../types/llm.types'
import { OpenAIProvider } from './openai-provider'
import { AnthropicProvider } from './anthropic-provider'
import { config } from '../../config'

export function createLLMClient(): LLMProvider {
  switch (config.llmProvider) {
    case 'openai':    return new OpenAIProvider()
    case 'anthropic': return new AnthropicProvider()
    default:
      throw new Error(`Unknown LLM provider: ${config.llmProvider}`)
  }
}
```

- [ ] **Step 5: Run all LLM tests**

```bash
npx jest src/lib/llm/ --no-coverage
```

Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/backend/src/lib/
git commit -m "feat: Anthropic provider and LLM factory — provider-agnostic adapter complete"
git push
```

---

## Task 4: GHL API client

**Files:**
- Create: `backend/src/lib/ghl-client.ts`
- Create: `backend/src/lib/ghl-client.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/lib/ghl-client.test.ts
import axios from 'axios'
import { Database } from '../db/index'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

function setTestEnv() {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/voice_copilot_test'
  process.env.REDIS_URL = 'redis://localhost:6379'
  process.env.TEMPORAL_ADDRESS = 'localhost:7233'
  process.env.GHL_WEBHOOK_SECRET = 'test'
  process.env.LLM_PROVIDER = 'openai'
  process.env.OPENAI_API_KEY = 'sk-test'
  process.env.NODE_ENV = 'test'
}

describe('GHLClient', () => {
  let GHLClient: typeof import('./ghl-client').GHLClient
  let mockDb: Partial<Database>

  beforeEach(async () => {
    setTestEnv()
    jest.resetModules()
    ;({ GHLClient } = await import('./ghl-client'))
    mockDb = {
      query: jest.fn().mockResolvedValue({
        rows: [{ access_token: 'tok-abc', refresh_token: 'ref-xyz', token_expires_at: null }],
      }),
    }
  })

  it('lists agents using the stored access token', async () => {
    mockedAxios.get = jest.fn().mockResolvedValue({
      data: { agents: [{ id: 'ag-1', name: 'Agent Alpha' }] },
    })
    const client = new GHLClient(mockDb as Database)
    const agents = await client.listAgents('loc-123')
    expect(agents).toHaveLength(1)
    expect(agents[0].name).toBe('Agent Alpha')
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/locations/loc-123'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok-abc' }) })
    )
  })

  it('retries with refreshed token on 401', async () => {
    mockedAxios.get = jest.fn()
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockResolvedValueOnce({ data: { agents: [] } })
    mockedAxios.post = jest.fn().mockResolvedValue({
      data: { access_token: 'new-tok', refresh_token: 'new-ref', expires_in: 86400 },
    })
    ;(mockDb.query as jest.Mock) = jest.fn()
      .mockResolvedValueOnce({ rows: [{ access_token: 'old-tok', refresh_token: 'ref-xyz', token_expires_at: null }] })
      .mockResolvedValue({ rows: [] }) // update query

    const client = new GHLClient(mockDb as Database)
    const agents = await client.listAgents('loc-123')
    expect(agents).toHaveLength(0)
    expect(mockedAxios.post).toHaveBeenCalledTimes(1) // refresh called once
    expect(mockedAxios.get).toHaveBeenCalledTimes(2)  // original + retry
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx jest src/lib/ghl-client.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module './ghl-client'`

- [ ] **Step 3: Create `backend/src/lib/ghl-client.ts`**

```typescript
import axios from 'axios'
import { db as defaultDb, Database } from '../db/index'
import { GHLAgent } from '../types/ghl.types'

const GHL_BASE = 'https://services.leadconnectorhq.com'

interface TokenRow {
  access_token: string
  refresh_token: string
  token_expires_at: Date | null
}

export class GHLClient {
  constructor(private readonly database: Database = defaultDb) {}

  private async getToken(locationId: string): Promise<TokenRow> {
    const { rows } = await this.database.query<TokenRow>(
      'SELECT access_token, refresh_token, token_expires_at FROM locations WHERE location_id = $1',
      [locationId]
    )
    if (!rows[0]) throw new Error(`No token found for locationId: ${locationId}`)
    return rows[0]
  }

  private async refreshToken(locationId: string, refreshToken: string): Promise<string> {
    const { data } = await axios.post(`${GHL_BASE}/oauth/token`, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.GHL_CLIENT_ID,
      client_secret: process.env.GHL_CLIENT_SECRET,
    })

    const expiresAt = new Date(Date.now() + data.expires_in * 1000)
    await this.database.query(
      `UPDATE locations SET access_token = $1, refresh_token = $2, token_expires_at = $3
       WHERE location_id = $4`,
      [data.access_token, data.refresh_token, expiresAt, locationId]
    )

    return data.access_token
  }

  private async get<T>(path: string, locationId: string, retried = false): Promise<T> {
    const token = await this.getToken(locationId)
    try {
      const { data } = await axios.get<T>(`${GHL_BASE}${path}`, {
        headers: { Authorization: `Bearer ${token.access_token}`, Version: '2021-07-28' },
      })
      return data
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 401 && !retried) {
        await this.refreshToken(locationId, token.refresh_token)
        return this.get<T>(path, locationId, true)
      }
      throw err
    }
  }

  async listAgents(locationId: string): Promise<GHLAgent[]> {
    const data = await this.get<{ agents: GHLAgent[] }>(
      `/locations/${locationId}/voice-agents`,
      locationId
    )
    return data.agents ?? []
  }
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx jest src/lib/ghl-client.test.ts --no-coverage
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/backend/src/lib/ghl-client.ts voice-ai-copilot/backend/src/lib/ghl-client.test.ts
git commit -m "feat: GHL API client with transparent token refresh on 401"
git push
```

---

## Task 5: SSE manager

**Files:**
- Create: `backend/src/lib/sse-manager.ts`
- Create: `backend/src/lib/sse-manager.test.ts`
- Create: `backend/src/routes/stream.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/lib/sse-manager.test.ts
import { SSEManager } from './sse-manager'
import { Response } from 'express'

function mockRes(): jest.Mocked<Partial<Response>> {
  return {
    write: jest.fn(),
    end: jest.fn(),
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
  }
}

describe('SSEManager', () => {
  let manager: SSEManager

  beforeEach(() => { manager = new SSEManager() })

  it('broadcasts an event to all connections for a locationId', () => {
    const res1 = mockRes()
    const res2 = mockRes()
    manager.add('loc-1', res1 as unknown as Response)
    manager.add('loc-1', res2 as unknown as Response)

    manager.broadcast('loc-1', { type: 'analysis.complete', agentId: 'ag-1' })

    const expected = expect.stringContaining('"type":"analysis.complete"')
    expect(res1.write).toHaveBeenCalledWith(expected)
    expect(res2.write).toHaveBeenCalledWith(expected)
  })

  it('does not broadcast to other locations', () => {
    const res1 = mockRes()
    const res2 = mockRes()
    manager.add('loc-1', res1 as unknown as Response)
    manager.add('loc-2', res2 as unknown as Response)

    manager.broadcast('loc-1', { type: 'analysis.complete', agentId: 'ag-1' })

    expect(res1.write).toHaveBeenCalled()
    expect(res2.write).not.toHaveBeenCalled()
  })

  it('removes a connection cleanly', () => {
    const res1 = mockRes()
    manager.add('loc-1', res1 as unknown as Response)
    manager.remove('loc-1', res1 as unknown as Response)

    manager.broadcast('loc-1', { type: 'analysis.complete', agentId: 'ag-1' })

    expect(res1.write).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx jest src/lib/sse-manager.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module './sse-manager'`

- [ ] **Step 3: Create `backend/src/lib/sse-manager.ts`**

```typescript
import { Response } from 'express'

export interface SSEEvent {
  type: 'analysis.complete' | 'analysis.failed' | 'transcript.ingested'
  agentId: string
  [key: string]: unknown
}

export class SSEManager {
  private connections = new Map<string, Set<Response>>()

  add(locationId: string, res: Response): void {
    if (!this.connections.has(locationId)) {
      this.connections.set(locationId, new Set())
    }
    this.connections.get(locationId)!.add(res)
  }

  remove(locationId: string, res: Response): void {
    this.connections.get(locationId)?.delete(res)
  }

  broadcast(locationId: string, event: SSEEvent): void {
    const clients = this.connections.get(locationId)
    if (!clients?.size) return

    const data = `data: ${JSON.stringify(event)}\n\n`
    for (const res of clients) {
      try {
        res.write(data)
      } catch {
        // Client disconnected mid-write — remove it
        this.remove(locationId, res)
      }
    }
  }
}

// Singleton used across the app
export const sseManager = new SSEManager()
```

- [ ] **Step 4: Create `backend/src/routes/stream.ts`**

```typescript
import { Router, Request, Response } from 'express'
import { ghlAuth, GHLRequest } from '../middleware/ghl-auth'
import { sseManager } from '../lib/sse-manager'

export const streamRouter = Router()

streamRouter.get('/', ghlAuth(), (req: Request, res: Response) => {
  const { locationId } = (req as GHLRequest).ghlContext

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  // Send initial heartbeat so the client knows it's connected
  res.write(`data: ${JSON.stringify({ type: 'connected', locationId })}\n\n`)

  sseManager.add(locationId, res)

  req.on('close', () => {
    sseManager.remove(locationId, res)
  })
})
```

- [ ] **Step 5: Register the stream route in `backend/src/app.ts`**

Add this import and route registration to `app.ts` after the existing imports:

```typescript
import { streamRouter } from './routes/stream'

// Add before the 404 handler:
app.use('/stream', streamRouter)
```

- [ ] **Step 6: Run SSE tests**

```bash
npx jest src/lib/sse-manager.test.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/backend/src/lib/sse-manager.ts voice-ai-copilot/backend/src/lib/sse-manager.test.ts voice-ai-copilot/backend/src/routes/stream.ts voice-ai-copilot/backend/src/app.ts
git commit -m "feat: SSE manager and /stream endpoint for live dashboard updates"
git push
```

---

## Task 6: KPI service

**Files:**
- Create: `backend/src/services/kpi-service.ts`
- Create: `backend/src/services/kpi-service.test.ts`
- Create: `backend/src/routes/kpi.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/services/kpi-service.test.ts
import { KpiService } from './kpi-service'
import { Database } from '../db/index'
import { KpiGoal } from '../types/analysis.types'

const mockDb = (): jest.Mocked<Partial<Database>> => ({
  query: jest.fn(),
})

const goals: KpiGoal[] = [
  { name: 'Book Appointment', description: 'Confirm a slot', weight: 0.6 },
  { name: 'Handle Objection', description: 'Address concerns', weight: 0.4 },
]

describe('KpiService', () => {
  it('returns kpi config for a known agentId', async () => {
    const db = mockDb()
    ;(db.query as jest.Mock).mockResolvedValue({
      rows: [{ id: 'kpi-1', agent_id: 'ag-1', goals, success_threshold: '0.70', updated_at: new Date() }],
    })
    const service = new KpiService(db as Database)
    const config = await service.getConfig('ag-1')
    expect(config).not.toBeNull()
    expect(config!.goals).toHaveLength(2)
    expect(config!.successThreshold).toBe(0.7)
  })

  it('returns null when no config exists', async () => {
    const db = mockDb()
    ;(db.query as jest.Mock).mockResolvedValue({ rows: [] })
    const service = new KpiService(db as Database)
    const config = await service.getConfig('ag-unknown')
    expect(config).toBeNull()
  })

  it('upserts a kpi config', async () => {
    const db = mockDb()
    ;(db.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'kpi-1' }] })
    const service = new KpiService(db as Database)
    await service.upsertConfig('ag-1', goals, 0.75)
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO kpi_configs'),
      expect.arrayContaining(['ag-1', 0.75])
    )
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx jest src/services/kpi-service.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module './kpi-service'`

- [ ] **Step 3: Create `backend/src/services/kpi-service.ts`**

```typescript
import { db as defaultDb, Database } from '../db/index'
import { KpiGoal } from '../types/analysis.types'

export interface KpiConfig {
  id: string
  agentId: string
  goals: KpiGoal[]
  successThreshold: number
  updatedAt: Date
}

export class KpiService {
  constructor(private readonly database: Database = defaultDb) {}

  async getConfig(agentId: string): Promise<KpiConfig | null> {
    const { rows } = await this.database.query(
      'SELECT id, agent_id, goals, success_threshold, updated_at FROM kpi_configs WHERE agent_id = $1',
      [agentId]
    )
    if (!rows[0]) return null
    const row = rows[0]
    return {
      id: row.id,
      agentId: row.agent_id,
      goals: row.goals as KpiGoal[],
      successThreshold: parseFloat(row.success_threshold),
      updatedAt: row.updated_at,
    }
  }

  async upsertConfig(agentId: string, goals: KpiGoal[], successThreshold: number): Promise<KpiConfig> {
    const { rows } = await this.database.query(
      `INSERT INTO kpi_configs (agent_id, goals, success_threshold)
       VALUES ($1, $2, $3)
       ON CONFLICT (agent_id)
       DO UPDATE SET goals = $2, success_threshold = $3, updated_at = NOW()
       RETURNING id, agent_id, goals, success_threshold, updated_at`,
      [agentId, JSON.stringify(goals), successThreshold]
    )
    const row = rows[0]
    return {
      id: row.id,
      agentId: row.agent_id,
      goals: row.goals as KpiGoal[],
      successThreshold: parseFloat(row.success_threshold),
      updatedAt: row.updated_at,
    }
  }
}
```

Note: The `ON CONFLICT (agent_id)` requires a unique constraint. Add it to the migration:

```sql
-- Add to 001_initial.sql after kpi_configs table definition:
ALTER TABLE kpi_configs ADD CONSTRAINT kpi_configs_agent_id_unique UNIQUE (agent_id);
```

Re-run migrations: `make migrate`

- [ ] **Step 4: Create `backend/src/routes/kpi.ts`**

```typescript
import { Router, Request, Response, NextFunction } from 'express'
import { ghlAuth, GHLRequest } from '../middleware/ghl-auth'
import { KpiService } from '../services/kpi-service'
import { AppError } from '../middleware/error-handler'

export const kpiRouter = Router()
const kpiService = new KpiService()

// GET /api/kpi/:agentId
kpiRouter.get('/:agentId', ghlAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await kpiService.getConfig(req.params.agentId)
    if (!config) throw new AppError('KPI config not found', 404, 'KPI_NOT_FOUND')
    res.json(config)
  } catch (err) { next(err) }
})

// PUT /api/kpi/:agentId
kpiRouter.put('/:agentId', ghlAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { goals, successThreshold } = req.body
    if (!Array.isArray(goals) || typeof successThreshold !== 'number') {
      throw new AppError('Invalid request body', 400, 'INVALID_BODY')
    }
    const config = await kpiService.upsertConfig(req.params.agentId, goals, successThreshold)
    res.json(config)
  } catch (err) { next(err) }
})
```

- [ ] **Step 5: Register in `backend/src/app.ts`**

```typescript
import { kpiRouter } from './routes/kpi'
// Add before 404 handler:
app.use('/api/kpi', kpiRouter)
```

- [ ] **Step 6: Run tests**

```bash
npx jest src/services/kpi-service.test.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/backend/src/services/ voice-ai-copilot/backend/src/routes/kpi.ts voice-ai-copilot/backend/src/app.ts
git commit -m "feat: KPI service with upsert and /api/kpi route"
git push
```

---

## Task 7: Temporal workflow + activities

**Files:**
- Create: `backend/src/activities/load-transcript.activity.ts`
- Create: `backend/src/activities/load-kpi-config.activity.ts`
- Create: `backend/src/activities/build-prompt.activity.ts`
- Create: `backend/src/activities/call-llm.activity.ts`
- Create: `backend/src/activities/persist-results.activity.ts`
- Create: `backend/src/activities/broadcast-sse.activity.ts`
- Create: `backend/src/workflows/analyze-call.workflow.ts`
- Create: `backend/src/workers/temporal-worker.ts`
- Create: `backend/src/workflows/analyze-call.test.ts`

- [ ] **Step 1: Create `backend/src/activities/load-transcript.activity.ts`**

```typescript
import { db } from '../db/index'
import { GHLTranscriptTurn } from '../types/ghl.types'

export interface TranscriptRow {
  id: string
  agentId: string
  locationId: string
  turns: GHLTranscriptTurn[]
  durationSeconds: number | null
}

export async function loadTranscript(transcriptId: string): Promise<TranscriptRow> {
  const { rows } = await db.query(
    'SELECT id, agent_id, location_id, turns, duration_seconds FROM transcripts WHERE id = $1',
    [transcriptId]
  )
  if (!rows[0]) throw new Error(`Transcript not found: ${transcriptId}`)
  const row = rows[0]
  return {
    id: row.id,
    agentId: row.agent_id,
    locationId: row.location_id,
    turns: row.turns as GHLTranscriptTurn[],
    durationSeconds: row.duration_seconds,
  }
}
```

- [ ] **Step 2: Create `backend/src/activities/load-kpi-config.activity.ts`**

```typescript
import { KpiService, KpiConfig } from '../services/kpi-service'

const kpiService = new KpiService()

export async function loadKpiConfig(agentId: string): Promise<KpiConfig> {
  const config = await kpiService.getConfig(agentId)
  if (!config) throw new Error(`No KPI config for agent: ${agentId}`)
  return config
}
```

- [ ] **Step 3: Create `backend/src/activities/build-prompt.activity.ts`**

```typescript
import { db } from '../db/index'
import { AnalysisPrompt } from '../types/llm.types'
import { TranscriptRow } from './load-transcript.activity'
import { KpiConfig } from '../services/kpi-service'

export async function buildPrompt(
  transcript: TranscriptRow,
  kpiConfig: KpiConfig
): Promise<AnalysisPrompt> {
  const { rows } = await db.query(
    'SELECT script FROM agents WHERE id = $1',
    [transcript.agentId]
  )
  const agentScript = rows[0]?.script ?? 'No script provided.'

  return {
    agentScript,
    turns: transcript.turns,
    kpiGoals: kpiConfig.goals,
  }
}
```

- [ ] **Step 4: Create `backend/src/activities/call-llm.activity.ts`**

```typescript
import { createLLMClient } from '../lib/llm/index'
import { AnalysisPrompt, AnalysisOutput } from '../types/llm.types'

export async function callLLM(prompt: AnalysisPrompt): Promise<AnalysisOutput & { provider: string; model: string }> {
  const client = createLLMClient()
  const output = await client.analyze(prompt)
  return { ...output, provider: client.providerName, model: client.modelName }
}
```

- [ ] **Step 5: Create `backend/src/activities/persist-results.activity.ts`**

```typescript
import { db } from '../db/index'
import { AnalysisOutput } from '../types/llm.types'
import { AnalysisJobData } from '../types/analysis.types'

export async function persistResults(
  output: AnalysisOutput & { provider: string; model: string },
  job: AnalysisJobData
): Promise<string> {
  const client = await db.getClient()
  try {
    await client.query('BEGIN')

    const { rows } = await client.query(
      `INSERT INTO analysis_results
         (transcript_id, kpi_config_id, overall_score, passed, kpi_scores, summary, llm_provider, llm_model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        job.transcriptId,
        job.kpiConfigId,
        output.overallScore,
        output.passed,
        JSON.stringify(output.kpiScores),
        output.summary,
        output.provider,
        output.model,
      ]
    )

    const analysisId = rows[0].id

    for (const ua of output.useActions) {
      await client.query(
        `INSERT INTO use_actions (analysis_id, transcript_turn_index, type, description)
         VALUES ($1, $2, $3, $4)`,
        [analysisId, ua.transcriptTurnIndex, ua.type, ua.description]
      )
    }

    await client.query(
      `UPDATE transcripts SET status = 'analyzed' WHERE id = $1`,
      [job.transcriptId]
    )

    await client.query('COMMIT')
    return analysisId
  } catch (err) {
    await client.query('ROLLBACK')
    await db.query(
      `UPDATE transcripts SET status = 'analysis_failed' WHERE id = $1`,
      [job.transcriptId]
    )
    throw err
  } finally {
    client.release()
  }
}
```

- [ ] **Step 6: Create `backend/src/activities/broadcast-sse.activity.ts`**

```typescript
import { sseManager } from '../lib/sse-manager'

export async function broadcastSSE(locationId: string, agentId: string): Promise<void> {
  sseManager.broadcast(locationId, { type: 'analysis.complete', agentId })
}

export async function broadcastSSEFailure(locationId: string, agentId: string): Promise<void> {
  sseManager.broadcast(locationId, { type: 'analysis.failed', agentId })
}
```

- [ ] **Step 7: Create `backend/src/workflows/analyze-call.workflow.ts`**

```typescript
import { proxyActivities, ActivityOptions } from '@temporalio/workflow'
import type * as activities from '../activities/index'

const defaultOptions: ActivityOptions = {
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 2, initialInterval: '1s' },
}

const llmOptions: ActivityOptions = {
  startToCloseTimeout: '2 minutes',
  retry: { maximumAttempts: 3, initialInterval: '2s', backoffCoefficient: 2 },
}

const {
  loadTranscript,
  loadKpiConfig,
  buildPrompt,
  persistResults,
  broadcastSSE,
  broadcastSSEFailure,
} = proxyActivities<typeof activities>(defaultOptions)

const { callLLM } = proxyActivities<typeof activities>(llmOptions)

export interface AnalyzeCallInput {
  transcriptId: string
  agentId: string
  locationId: string
  kpiConfigId: string
}

export async function analyzeCallWorkflow(input: AnalyzeCallInput): Promise<void> {
  try {
    const transcript = await loadTranscript(input.transcriptId)
    const kpiConfig  = await loadKpiConfig(input.agentId)
    const prompt     = await buildPrompt(transcript, kpiConfig)
    const output     = await callLLM(prompt)
    await persistResults(output, input)
    await broadcastSSE(input.locationId, input.agentId)
  } catch {
    await broadcastSSEFailure(input.locationId, input.agentId)
    throw  // re-throw so Temporal marks workflow as failed
  }
}
```

- [ ] **Step 8: Create `backend/src/activities/index.ts`**

```typescript
export { loadTranscript } from './load-transcript.activity'
export { loadKpiConfig } from './load-kpi-config.activity'
export { buildPrompt } from './build-prompt.activity'
export { callLLM } from './call-llm.activity'
export { persistResults } from './persist-results.activity'
export { broadcastSSE, broadcastSSEFailure } from './broadcast-sse.activity'
```

- [ ] **Step 9: Create `backend/src/workers/temporal-worker.ts`**

```typescript
import { Worker } from '@temporalio/worker'
import * as activities from '../activities/index'
import { config } from '../config'

async function run() {
  const worker = await Worker.create({
    workflowsPath: require.resolve('../workflows/analyze-call.workflow'),
    activities,
    taskQueue: 'voice-ai-analysis',
    connection: { address: config.temporalAddress },
    namespace: config.temporalNamespace,
  })

  console.log('Temporal worker started — listening on task queue: voice-ai-analysis')
  await worker.run()
}

run().catch((err) => {
  console.error('Worker failed to start:', err)
  process.exit(1)
})
```

- [ ] **Step 10: Write the workflow integration test**

```typescript
// backend/src/workflows/analyze-call.test.ts
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { Worker } from '@temporalio/worker'
import { analyzeCallWorkflow, AnalyzeCallInput } from './analyze-call.workflow'
import * as activities from '../activities/index'

describe('analyzeCallWorkflow', () => {
  let env: TestWorkflowEnvironment

  beforeAll(async () => {
    env = await TestWorkflowEnvironment.createLocal()
  }, 60_000)

  afterAll(async () => {
    await env.teardown()
  })

  it('completes successfully with mocked activities', async () => {
    const mockActivities: typeof activities = {
      loadTranscript: jest.fn().mockResolvedValue({
        id: 'tr-1', agentId: 'ag-1', locationId: 'loc-1',
        turns: [{ speaker: 'agent', text: 'Hi', timestamp_ms: 0 }],
        durationSeconds: 60,
      }),
      loadKpiConfig: jest.fn().mockResolvedValue({
        id: 'kpi-1', agentId: 'ag-1',
        goals: [{ name: 'Book Appointment', description: 'Confirm slot', weight: 1 }],
        successThreshold: 0.7,
        updatedAt: new Date(),
      }),
      buildPrompt: jest.fn().mockResolvedValue({
        agentScript: 'Book appointments.',
        turns: [{ speaker: 'agent', text: 'Hi', timestamp_ms: 0 }],
        kpiGoals: [{ name: 'Book Appointment', description: 'Confirm slot', weight: 1 }],
      }),
      callLLM: jest.fn().mockResolvedValue({
        overallScore: 0.85, passed: true,
        kpiScores: [{ goal: 'Book Appointment', score: 0.85, passed: true, evidence: 'Confirmed 3pm' }],
        summary: 'Good call.', useActions: [],
        provider: 'openai', model: 'gpt-4o',
      }),
      persistResults: jest.fn().mockResolvedValue('ar-1'),
      broadcastSSE: jest.fn().mockResolvedValue(undefined),
      broadcastSSEFailure: jest.fn().mockResolvedValue(undefined),
    }

    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue: 'test-queue',
      workflowsPath: require.resolve('./analyze-call.workflow'),
      activities: mockActivities,
    })

    const input: AnalyzeCallInput = {
      transcriptId: 'tr-1', agentId: 'ag-1',
      locationId: 'loc-1', kpiConfigId: 'kpi-1',
    }

    await worker.runUntil(
      env.client.workflow.execute(analyzeCallWorkflow, {
        taskQueue: 'test-queue',
        workflowId: 'test-wf-1',
        args: [input],
      })
    )

    expect(mockActivities.callLLM).toHaveBeenCalledTimes(1)
    expect(mockActivities.persistResults).toHaveBeenCalledTimes(1)
    expect(mockActivities.broadcastSSE).toHaveBeenCalledWith('loc-1', 'ag-1')
  }, 30_000)
})
```

- [ ] **Step 11: Start Temporal and run the workflow test**

```bash
cd voice-ai-copilot
docker compose up -d temporal temporal-ui
```

Wait ~15 seconds for Temporal to initialize, then:

```bash
cd backend
npx jest src/workflows/analyze-call.test.ts --no-coverage --testTimeout=60000
```

Expected: PASS (1 test)

- [ ] **Step 12: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/backend/src/activities/ voice-ai-copilot/backend/src/workflows/ voice-ai-copilot/backend/src/workers/
git commit -m "feat: Temporal workflow, all activities, and worker setup"
git push
```

---

## Task 8: Webhook route (transcript ingestion)

**Files:**
- Create: `backend/src/services/transcript-service.ts`
- Create: `backend/src/routes/webhooks.ts`
- Create: `backend/src/routes/webhooks.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/routes/webhooks.test.ts
import request from 'supertest'
import crypto from 'crypto'
import express from 'express'

function makeSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

function setTestEnv() {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/voice_copilot_test'
  process.env.REDIS_URL = 'redis://localhost:6379'
  process.env.TEMPORAL_ADDRESS = 'localhost:7233'
  process.env.GHL_WEBHOOK_SECRET = 'test-webhook-secret'
  process.env.LLM_PROVIDER = 'openai'
  process.env.OPENAI_API_KEY = 'sk-test'
  process.env.NODE_ENV = 'test'
}

describe('POST /webhooks/call-completed', () => {
  let app: express.Express
  const SECRET = 'test-webhook-secret'

  const validPayload = {
    callId: 'call-abc-123',
    locationId: 'loc-test',
    agentId: 'ag-test',
    callerPhone: '+1234567890',
    durationSeconds: 68,
    turns: [
      { speaker: 'agent', text: 'Hello!', timestamp_ms: 0 },
      { speaker: 'user', text: 'Hi there', timestamp_ms: 2000 },
    ],
  }

  beforeAll(async () => {
    setTestEnv()
    jest.resetModules()

    // Mock TranscriptService and Temporal client
    jest.mock('../services/transcript-service', () => ({
      TranscriptService: jest.fn().mockImplementation(() => ({
        ingest: jest.fn().mockResolvedValue({ id: 'tr-new', kpiConfigId: 'kpi-1' }),
      })),
    }))
    jest.mock('@temporalio/client', () => ({
      Client: jest.fn().mockImplementation(() => ({
        workflow: { start: jest.fn().mockResolvedValue({ workflowId: 'wf-1' }) },
      })),
      Connection: { connect: jest.fn().mockResolvedValue({}) },
    }))

    const { app: a } = await import('../app')
    app = a
  })

  it('returns 401 for missing signature', async () => {
    const res = await request(app)
      .post('/webhooks/call-completed')
      .send(validPayload)
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('INVALID_SIGNATURE')
  })

  it('returns 401 for wrong signature', async () => {
    const body = JSON.stringify(validPayload)
    const res = await request(app)
      .post('/webhooks/call-completed')
      .set('Content-Type', 'application/json')
      .set('x-ghl-signature', 'wrong-sig')
      .send(body)
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('INVALID_SIGNATURE')
  })

  it('returns 200 and enqueues workflow for valid signed payload', async () => {
    const body = JSON.stringify(validPayload)
    const sig = makeSignature(body, SECRET)
    const res = await request(app)
      .post('/webhooks/call-completed')
      .set('Content-Type', 'application/json')
      .set('x-ghl-signature', sig)
      .send(body)
    expect(res.status).toBe(200)
    expect(res.body.received).toBe(true)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx jest src/routes/webhooks.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../services/transcript-service'`

- [ ] **Step 3: Create `backend/src/services/transcript-service.ts`**

```typescript
import { db as defaultDb, Database } from '../db/index'
import { GHLCallCompletedPayload } from '../types/ghl.types'
import { KpiService } from './kpi-service'

export interface IngestResult {
  id: string
  kpiConfigId: string | null
  isNew: boolean
}

export class TranscriptService {
  private kpiService: KpiService

  constructor(private readonly database: Database = defaultDb) {
    this.kpiService = new KpiService(database)
  }

  async ingest(payload: GHLCallCompletedPayload): Promise<IngestResult> {
    // Check idempotency — ghl_call_id is UNIQUE
    const existing = await this.database.query(
      'SELECT id FROM transcripts WHERE ghl_call_id = $1',
      [payload.callId]
    )
    if (existing.rows[0]) {
      const kpiConfig = await this.kpiService.getConfig(payload.agentId)
      return { id: existing.rows[0].id, kpiConfigId: kpiConfig?.id ?? null, isNew: false }
    }

    const { rows } = await this.database.query(
      `INSERT INTO transcripts
         (agent_id, location_id, ghl_call_id, caller_phone, duration_seconds, turns, raw_payload, status)
       VALUES (
         (SELECT id FROM agents WHERE ghl_agent_id = $1 AND location_id = $2),
         $2, $3, $4, $5, $6, $7, 'pending'
       )
       RETURNING id`,
      [
        payload.agentId,
        payload.locationId,
        payload.callId,
        payload.callerPhone ?? null,
        payload.durationSeconds ?? null,
        JSON.stringify(payload.turns),
        JSON.stringify(payload),
      ]
    )

    const kpiConfig = await this.kpiService.getConfig(payload.agentId)
    return { id: rows[0].id, kpiConfigId: kpiConfig?.id ?? null, isNew: true }
  }
}
```

- [ ] **Step 4: Create `backend/src/routes/webhooks.ts`**

```typescript
import { Router, Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { Client, Connection } from '@temporalio/client'
import { TranscriptService } from '../services/transcript-service'
import { GHLCallCompletedPayload } from '../types/ghl.types'
import { config } from '../config'

export const webhookRouter = Router()

// Raw body needed for HMAC verification — must be registered before json()
webhookRouter.use(express.raw({ type: 'application/json' }))

function verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature) return false
  const expected = crypto
    .createHmac('sha256', config.ghlWebhookSecret)
    .update(rawBody)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

let temporalClient: Client | null = null

async function getTemporalClient(): Promise<Client> {
  if (!temporalClient) {
    const connection = await Connection.connect({ address: config.temporalAddress })
    temporalClient = new Client({ connection, namespace: config.temporalNamespace })
  }
  return temporalClient
}

const transcriptService = new TranscriptService()

webhookRouter.post('/call-completed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawBody = req.body as Buffer
    const signature = req.headers['x-ghl-signature'] as string | undefined

    if (!verifySignature(rawBody, signature)) {
      res.status(401).json({ error: 'Invalid signature', code: 'INVALID_SIGNATURE' })
      return
    }

    const payload: GHLCallCompletedPayload = JSON.parse(rawBody.toString())
    const result = await transcriptService.ingest(payload)

    // Return 200 immediately — GHL should not wait for analysis
    res.json({ received: true, transcriptId: result.id })

    // Enqueue Temporal workflow after response is sent (idempotent — skip if not new)
    if (result.isNew && result.kpiConfigId) {
      const client = await getTemporalClient()
      await client.workflow.start('analyzeCallWorkflow', {
        taskQueue: 'voice-ai-analysis',
        workflowId: `analyze-${result.id}`,
        args: [{
          transcriptId: result.id,
          agentId: payload.agentId,
          locationId: payload.locationId,
          kpiConfigId: result.kpiConfigId,
        }],
      })
    }
  } catch (err) { next(err) }
})
```

Add this import at the top of `webhooks.ts`:

```typescript
import express from 'express'
```

- [ ] **Step 5: Register webhook route in `backend/src/app.ts`**

```typescript
import { webhookRouter } from './routes/webhooks'
// Add BEFORE the json() middleware registration so raw body parsing works:
app.use('/webhooks', webhookRouter)
// All other routes get json():
app.use(express.json({ limit: '1mb' }))
```

- [ ] **Step 6: Run — expect PASS**

```bash
npx jest src/routes/webhooks.test.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 7: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/backend/src/
git commit -m "feat: webhook handler with HMAC verification, idempotency, and Temporal enqueue"
git push
```

---

## Task 9: Agents route

**Files:**
- Create: `backend/src/routes/agents.ts`
- Create: `backend/src/routes/agents.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/routes/agents.test.ts
import request from 'supertest'

function setTestEnv() {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/voice_copilot_test'
  process.env.REDIS_URL = 'redis://localhost:6379'
  process.env.TEMPORAL_ADDRESS = 'localhost:7233'
  process.env.GHL_WEBHOOK_SECRET = 'test'
  process.env.LLM_PROVIDER = 'openai'
  process.env.OPENAI_API_KEY = 'sk-test'
  process.env.NODE_ENV = 'test'
}

describe('GET /api/agents', () => {
  let app: import('express').Express

  beforeAll(async () => {
    setTestEnv()
    jest.resetModules()
    jest.mock('../middleware/ghl-auth', () => ({
      ghlAuth: () => (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
        ;(req as typeof req & { ghlContext: { locationId: string } }).ghlContext = { locationId: 'loc-test' }
        next()
      },
    }))
    jest.mock('../db/index', () => ({
      db: {
        query: jest.fn().mockResolvedValue({
          rows: [{
            id: 'ag-1', ghl_agent_id: 'ghl-ag-1', name: 'Agent Alpha',
            script: 'Book appointments.',
            pass_rate: '0.75', total_calls: '12', open_use_actions: '2',
          }],
        }),
      },
    }))
    const mod = await import('../app')
    app = mod.app
  })

  it('returns agent list with metrics for a locationId', async () => {
    const res = await request(app).get('/api/agents?locationId=loc-test')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0].name).toBe('Agent Alpha')
    expect(res.body[0].passRate).toBe(0.75)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx jest src/routes/agents.test.ts --no-coverage
```

Expected: FAIL — route not registered yet.

- [ ] **Step 3: Create `backend/src/routes/agents.ts`**

```typescript
import { Router, Request, Response, NextFunction } from 'express'
import { ghlAuth, GHLRequest } from '../middleware/ghl-auth'
import { db } from '../db/index'
import { AppError } from '../middleware/error-handler'

export const agentsRouter = Router()

// GET /api/agents — list all agents with aggregate metrics for the location
agentsRouter.get('/', ghlAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locationId } = (req as GHLRequest).ghlContext
    const { rows } = await db.query(
      `SELECT
         a.id, a.ghl_agent_id, a.name, a.script,
         ROUND(
           COUNT(ar.id) FILTER (WHERE ar.passed = true)::numeric /
           NULLIF(COUNT(ar.id), 0), 2
         ) AS pass_rate,
         COUNT(ar.id) AS total_calls,
         COUNT(ua.id) AS open_use_actions
       FROM agents a
       LEFT JOIN transcripts t   ON t.agent_id = a.id
       LEFT JOIN analysis_results ar ON ar.transcript_id = t.id
       LEFT JOIN use_actions ua  ON ua.analysis_id = ar.id
       WHERE a.location_id = $1
       GROUP BY a.id
       ORDER BY a.name`,
      [locationId]
    )
    res.json(rows.map((r) => ({
      id: r.id,
      ghlAgentId: r.ghl_agent_id,
      name: r.name,
      script: r.script,
      passRate: r.pass_rate ? parseFloat(r.pass_rate) : null,
      totalCalls: parseInt(r.total_calls, 10),
      openUseActions: parseInt(r.open_use_actions, 10),
    })))
  } catch (err) { next(err) }
})

// GET /api/agents/:id/analysis — analysis results for one agent
agentsRouter.get('/:id/analysis', ghlAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await db.query(
      `SELECT
         ar.id, ar.overall_score, ar.passed, ar.kpi_scores, ar.summary, ar.analyzed_at,
         t.id AS transcript_id, t.ghl_call_id, t.duration_seconds, t.ingested_at, t.turns,
         COALESCE(
           json_agg(ua ORDER BY ua.transcript_turn_index) FILTER (WHERE ua.id IS NOT NULL),
           '[]'
         ) AS use_actions
       FROM analysis_results ar
       JOIN transcripts t ON t.id = ar.transcript_id
       LEFT JOIN use_actions ua ON ua.analysis_id = ar.id
       WHERE t.agent_id = $1
       GROUP BY ar.id, t.id
       ORDER BY ar.analyzed_at DESC
       LIMIT 50`,
      [req.params.id]
    )
    if (!rows.length) throw new AppError('Agent not found or no analyses yet', 404, 'AGENT_NOT_FOUND')
    res.json(rows)
  } catch (err) { next(err) }
})
```

- [ ] **Step 4: Register in `backend/src/app.ts`**

```typescript
import { agentsRouter } from './routes/agents'
// Add before 404 handler:
app.use('/api/agents', agentsRouter)
```

- [ ] **Step 5: Run — expect PASS**

```bash
npx jest src/routes/agents.test.ts --no-coverage
```

Expected: PASS (1 test)

- [ ] **Step 6: Run full suite**

```bash
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/backend/src/
git commit -m "feat: agents route with aggregate metrics and analysis drill-down"
git push
```

---

## Plan 2 Complete

**Verification:**

```bash
cd voice-ai-copilot/backend && npm test
```

Expected: All tests pass.

**What you have:**
- Full TypeScript type system (`ghl.types.ts`, `analysis.types.ts`, `llm.types.ts`)
- Provider-agnostic LLM adapter — OpenAI and Anthropic, both validated with Zod
- GHL API client with transparent token refresh
- SSE manager + `/stream` endpoint
- KPI service + `/api/kpi` route
- All 6 Temporal activities
- `analyzeCallWorkflow` — durable, retry-safe pipeline
- Temporal worker connecting to the `voice-ai-analysis` task queue
- Webhook handler with HMAC-SHA256 verification, idempotency, instant 200 response
- Agents route with aggregate metrics and per-agent analysis drill-down

**Continue with:** `docs/superpowers/plans/2026-05-23-03-frontend-widget.md`
