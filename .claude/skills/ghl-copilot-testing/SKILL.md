---
name: ghl-copilot-testing
description: This skill should be used when writing tests, understanding test patterns, or improving test coverage in the Voice AI Observability Copilot. Also triggers when the user says "write tests", "add tests", "test this", "how to test", "mock this", "testing patterns", "coverage", or asks about Jest, Vitest, or Supertest usage in this project.
---

# Testing the GHL Voice AI Copilot

## Test Infrastructure

| Layer | Framework | Config | Run Command |
|---|---|---|---|
| Backend | Jest + ts-jest + Supertest | `backend/jest.config.ts` | `npm test --prefix voice-ai-copilot/backend` |
| Frontend | Vitest + Vue Test Utils | `frontend/vite.config.ts` | `npm test --prefix voice-ai-copilot/frontend` |

Backend tests require `postgres_test` container on port 5433: `docker compose up -d postgres_test`

## Test File Locations

Tests are **colocated** with source files using `.test.ts` suffix:
```
backend/src/config.test.ts
backend/src/app.test.ts
backend/src/middleware/ghl-auth.test.ts
backend/src/middleware/error-handler.test.ts
backend/src/routes/webhooks.test.ts
backend/src/routes/agents.test.ts
backend/src/services/kpi-service.test.ts
backend/src/lib/ghl-client.test.ts
backend/src/lib/llm/openai-provider.test.ts
backend/src/lib/llm/anthropic-provider.test.ts
backend/src/lib/sse-manager.test.ts
backend/src/db/index.test.ts
backend/src/db/migrate.test.ts
backend/src/workflows/analyze-call.test.ts

frontend/src/App.test.ts
frontend/src/stores/agents.test.ts
frontend/src/services/api.test.ts
frontend/src/components/AgentCard.test.ts
frontend/src/components/MetricCard.test.ts
frontend/src/components/TranscriptViewer.test.ts
frontend/src/views/AgentDetail.test.ts
```

## Backend Test Patterns

### Environment Setup (Required for Every Test File)

```typescript
// Set env vars BEFORE importing modules that read config
beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/voice_copilot_test';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.TEMPORAL_ADDRESS = 'localhost:7233';
  process.env.GHL_WEBHOOK_SECRET = 'test-secret';
  process.env.LLM_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.NODE_ENV = 'test';
  jest.resetModules(); // Clear cached imports
});
```

### Mocking the Database

```typescript
const mockDb = {
  query: jest.fn().mockResolvedValue({ rows: [{ id: '1', name: 'Agent' }] }),
  getClient: jest.fn(),
  end: jest.fn(),
};
// Pass mockDb to services/middleware that accept a db override
```

### Route Testing with Supertest

```typescript
import request from 'supertest';
import { app } from '../app';

it('GET /health returns 200', async () => {
  const res = await request(app).get('/health');
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('ok');
});
```

### Middleware Testing

```typescript
// Create isolated Express app with just the middleware + test route
const testApp = express();
testApp.use(express.json());
testApp.get('/test', ghlAuth(mockDb), (req, res) => {
  res.json({ locationId: (req as GHLRequest).ghlContext.locationId });
});
```

### Temporal Workflow Testing

```typescript
// Use Temporal's TestWorkflowEnvironment for workflow tests
// Mock activities, verify workflow calls them in order
// See backend/src/workflows/analyze-call.test.ts for pattern
```

## Frontend Test Patterns

### Component Testing with Vue Test Utils

```typescript
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AgentCard from './AgentCard.vue';

beforeEach(() => {
  setActivePinia(createPinia());
});

it('renders agent name', () => {
  const wrapper = mount(AgentCard, {
    props: { agent: { id: '1', name: 'Sales Bot', passRate: 0.85 } },
  });
  expect(wrapper.text()).toContain('Sales Bot');
});
```

### Store Testing

```typescript
import { setActivePinia, createPinia } from 'pinia';
import { useAgentsStore } from './agents';

beforeEach(() => {
  setActivePinia(createPinia());
});

it('fetches agents', async () => {
  vi.mock('../api/agents', () => ({
    agentsApi: { list: vi.fn().mockResolvedValue([{ id: '1', name: 'Bot' }]) },
  }));
  const store = useAgentsStore();
  await store.fetchAll('location-1');
  expect(store.agents).toHaveLength(1);
});
```

### Mocking API Calls

```typescript
vi.mock('../api/agents', () => ({
  agentsApi: {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue({ id: '1' }),
  },
}));
```

## Running Tests

```bash
# All backend tests (sequential — required for DB tests)
cd voice-ai-copilot/backend && npx jest --runInBand

# Single backend test file
cd voice-ai-copilot/backend && npx jest src/routes/agents.test.ts --no-coverage

# All frontend tests
cd voice-ai-copilot/frontend && npx vitest run

# Frontend watch mode
cd voice-ai-copilot/frontend && npx vitest

# Both (from monorepo root)
cd voice-ai-copilot && npm test
```

## Coverage Targets

- Services + lib: 90%+
- Routes: 80%+
- Vue components: Critical paths only
- Temporal workflows: Activity call order + failure paths

## Additional Resources

For detailed mock strategies, integration test setup, and edge case patterns, consult:
- **`references/test-patterns.md`** — Advanced mocking, DB integration tests, SSE testing
