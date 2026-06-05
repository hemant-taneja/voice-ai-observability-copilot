# Voice AI Copilot — Advanced Test Patterns

## Backend Integration Tests

### Database Integration Tests

When testing against the real test database:

```typescript
import { Pool } from 'pg';

const TEST_URL = 'postgresql://postgres:postgres@localhost:5433/voice_copilot_test';

describe('agent creation', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_URL });
    // Run migrations to ensure schema exists
    const { runMigrations } = await import('../db/migrate');
    await runMigrations(TEST_URL);
  });

  beforeEach(async () => {
    // Clean tables in dependency order
    await pool.query('DELETE FROM use_actions');
    await pool.query('DELETE FROM analysis_results');
    await pool.query('DELETE FROM transcripts');
    await pool.query('DELETE FROM kpi_configs');
    await pool.query('DELETE FROM agents');
    await pool.query('DELETE FROM locations');
    // Insert test location
    await pool.query(
      `INSERT INTO locations (location_id, name) VALUES ('test-loc', 'Test Location')`
    );
  });

  afterAll(() => pool.end());

  it('inserts agent with FK to location', async () => {
    const result = await pool.query(
      `INSERT INTO agents (location_id, ghl_agent_id, name)
       VALUES ('test-loc', 'agent-1', 'Sales Bot')
       RETURNING *`
    );
    expect(result.rows[0].name).toBe('Sales Bot');
    expect(result.rows[0].location_id).toBe('test-loc');
  });
});
```

### Webhook Route Tests

```typescript
import request from 'supertest';
import crypto from 'crypto';

describe('POST /webhooks/call-completed', () => {
  function signPayload(body: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  it('accepts valid signed webhook', async () => {
    const body = JSON.stringify({
      ghl_call_id: 'call-123',
      agent_id: 'agent-1',
      turns: [{ speaker: 'agent', text: 'Hello' }],
    });
    const signature = signPayload(body, 'test-secret');

    const res = await request(app)
      .post('/webhooks/call-completed')
      .set('x-ghl-signature', signature)
      .set('Content-Type', 'application/json')
      .send(body);

    expect(res.status).toBe(200);
  });

  it('rejects invalid signature', async () => {
    const res = await request(app)
      .post('/webhooks/call-completed')
      .set('x-ghl-signature', 'bad-signature')
      .set('Content-Type', 'application/json')
      .send('{}');

    expect(res.status).toBe(401);
  });
});
```

### SSE Manager Tests

```typescript
import { SSEManager } from './sse-manager';

describe('SSEManager', () => {
  it('broadcasts to connected clients for a location', () => {
    const manager = new SSEManager();
    const mockRes = {
      write: jest.fn(),
      on: jest.fn(),
    } as any;

    manager.add('loc-1', mockRes);
    manager.broadcast('loc-1', { type: 'analysis.complete', agentId: 'a1' });

    expect(mockRes.write).toHaveBeenCalledWith(
      expect.stringContaining('analysis.complete')
    );
  });

  it('does not broadcast to other locations', () => {
    const manager = new SSEManager();
    const mockRes = { write: jest.fn(), on: jest.fn() } as any;

    manager.add('loc-1', mockRes);
    manager.broadcast('loc-2', { type: 'analysis.complete', agentId: 'a1' });

    expect(mockRes.write).not.toHaveBeenCalled();
  });
});
```

### GHL Client Tests

```typescript
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GHLClient', () => {
  it('refreshes token on 401 and retries', async () => {
    // First call returns 401
    mockedAxios.get.mockRejectedValueOnce({
      response: { status: 401 },
    });
    // Token refresh succeeds
    mockedAxios.post.mockResolvedValueOnce({
      data: { access_token: 'new-token', expires_in: 3600 },
    });
    // Retry succeeds
    mockedAxios.get.mockResolvedValueOnce({
      data: { agents: [{ id: '1', name: 'Bot' }] },
    });

    // Verify retry happened with new token
  });
});
```

## Frontend Test Patterns

### Component Tests with Pinia

```typescript
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import AgentDetail from '../views/AgentDetail.vue';

it('loads agent on mount', () => {
  const wrapper = mount(AgentDetail, {
    global: {
      plugins: [
        createTestingPinia({
          initialState: {
            agents: { selectedAgent: { id: '1', name: 'Bot' } },
          },
        }),
      ],
    },
    props: { id: '1' },
  });

  expect(wrapper.text()).toContain('Bot');
});
```

### SSE Composable Tests

```typescript
import { useSSE } from './useSSE';

class MockEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  close = vi.fn();

  simulateMessage(data: string) {
    this.onmessage?.(new MessageEvent('message', { data }));
  }

  simulateError() {
    this.onerror?.(new Event('error'));
  }
}

// Mock global EventSource
vi.stubGlobal('EventSource', MockEventSource);

it('reconnects on error with backoff', async () => {
  const { connect } = useSSE();
  connect('loc-1');
  // Simulate error
  // Verify reconnection attempt
});
```

### Testing Vue Components with Slots

```typescript
import { mount } from '@vue/test-utils';
import MetricCard from './MetricCard.vue';

it('renders value with count-up animation target', () => {
  const wrapper = mount(MetricCard, {
    props: { label: 'Total Calls', value: 42, icon: 'phone' },
  });
  expect(wrapper.find('.metric-value').text()).toContain('42');
  expect(wrapper.find('.metric-label').text()).toContain('Total Calls');
});
```

## Mock Strategies

### When to Mock vs Integration Test

| Use Mock When | Use Integration When |
|---|---|
| External API (GHL, LLM) | Database queries |
| Temporal client | Migration runner |
| File system operations | Express route chain |
| Timer-based operations | Middleware chain |

### Mock Factories

Create reusable mock factories for common objects:

```typescript
// test-utils/factories.ts
export function createMockAgent(overrides = {}) {
  return {
    id: 'agent-uuid',
    location_id: 'test-loc',
    ghl_agent_id: 'ghl-agent-1',
    name: 'Test Agent',
    script: 'Hello, how can I help?',
    ...overrides,
  };
}

export function createMockTranscript(overrides = {}) {
  return {
    id: 'transcript-uuid',
    agent_id: 'agent-uuid',
    location_id: 'test-loc',
    ghl_call_id: 'call-123',
    status: 'pending',
    turns: [
      { speaker: 'agent', text: 'Hello', timestamp_ms: 0 },
      { speaker: 'caller', text: 'Hi there', timestamp_ms: 1500 },
    ],
    ...overrides,
  };
}

export function createMockAnalysisResult(overrides = {}) {
  return {
    id: 'analysis-uuid',
    transcript_id: 'transcript-uuid',
    overall_score: 0.85,
    passed: true,
    kpi_scores: [
      { goal: 'Greeting', score: 0.9, passed: true, evidence: 'Good greeting' },
    ],
    summary: 'Overall good performance',
    llm_provider: 'openai',
    llm_model: 'gpt-4o',
    ...overrides,
  };
}
```

## Test Configuration Details

### Backend Jest Config (`jest.config.ts`)
- Preset: `ts-jest`
- Environment: `node`
- Roots: `<rootDir>/src`
- Test match: `**/*.test.ts`
- Run with `--runInBand` (sequential for DB tests)

### Frontend Vitest Config
- Configured in `vite.config.ts`
- Environment: `jsdom`
- Setup file: `src/test-setup.ts`
- Run with `vitest` or `vitest run`
