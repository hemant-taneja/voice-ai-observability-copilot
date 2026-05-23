# Voice AI Copilot — Plan 3: Frontend + Widget + Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Vue 3 dashboard (Dashboard view, AgentDetail view, all components), the GHL custom JS widget, seed data for a rich demo, and the README + CHANGELOG.

**Architecture:** Vue 3 + TypeScript + Vite + Pinia + TailwindCSS. Components read from Pinia stores; stores call the API layer. SSE updates trigger store refreshes. Design system uses CSS variables (Dark Signal aesthetic). Widget is a standalone `inject.js` that embeds an iframe into the GHL interface.

**Tech Stack:** Vue 3, Vite, TypeScript, Pinia, TailwindCSS, vue-chartjs, @vueuse/core, Vitest, Vue Test Utils

**Prerequisite:** Plans 1 and 2 complete — backend running on port 3000.

---

## Task 1: Vue 3 + Vite + TypeScript project setup

**Files:**
- Create: `voice-ai-copilot/frontend/package.json`
- Create: `voice-ai-copilot/frontend/vite.config.ts`
- Create: `voice-ai-copilot/frontend/tsconfig.json`
- Create: `voice-ai-copilot/frontend/index.html`
- Create: `voice-ai-copilot/frontend/src/main.ts`

- [ ] **Step 1: Scaffold the frontend**

```bash
cd voice-ai-copilot
npm create vite@latest frontend -- --template vue-ts
cd frontend
npm install
```

- [ ] **Step 2: Install additional dependencies**

```bash
npm install pinia vue-router@4 axios @vueuse/core vue-chartjs chart.js
npm install -D tailwindcss postcss autoprefixer vitest @vue/test-utils jsdom @vitejs/plugin-vue
npx tailwindcss init -p
```

- [ ] **Step 3: Update `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/stream': 'http://localhost:3000',
      '/webhooks': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [ ] **Step 4: Configure Tailwind — `frontend/tailwind.config.js`**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 5: Update `frontend/package.json` scripts**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 6: Verify frontend starts**

```bash
npm run dev
```

Expected: Vite dev server on `http://localhost:5173`. Kill with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/frontend/
git commit -m "chore: vue 3 + vite + typescript + tailwind + pinia frontend scaffold"
git push
```

---

## Task 2: Design system — CSS variables + fonts

**Files:**
- Create: `frontend/src/assets/design-system.css`
- Modify: `frontend/src/main.ts`
- Modify: `frontend/src/style.css`

- [ ] **Step 1: Create `frontend/src/assets/design-system.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500&display=swap');

:root {
  /* Background layers */
  --bg-base:      #0A0B0E;
  --bg-surface:   #111318;
  --bg-elevated:  #181B22;
  --bg-hover:     #1E2230;

  /* Borders */
  --border:       #1E2230;
  --border-bright:#2A3044;

  /* Text */
  --text-primary:   #F0F4FF;
  --text-secondary: #7C8BA0;
  --text-muted:     #3D4A5C;

  /* Signal colors */
  --signal:   #F59E0B;  /* amber — live, use actions */
  --pass:     #10B981;  /* emerald */
  --fail:     #F43F5E;  /* rose */
  --warning:  #FB923C;  /* orange */
  --info:     #818CF8;  /* indigo */

  /* Typography */
  --font-display: 'Syne', sans-serif;
  --font-mono:    'IBM Plex Mono', monospace;
  --font-ui:      'DM Sans', sans-serif;

  /* Spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* Utility classes used across components */
.mono { font-family: var(--font-mono); }
.display { font-family: var(--font-display); }
.text-secondary { color: var(--text-secondary); }
.text-muted { color: var(--text-muted); }

.surface {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.badge-pass    { background: rgba(16,185,129,0.12); color: var(--pass); }
.badge-fail    { background: rgba(244, 63, 94,0.12); color: var(--fail); }
.badge-signal  { background: rgba(245,158,11,0.12);  color: var(--signal); }
.badge-info    { background: rgba(129,140,248,0.12); color: var(--info); }
```

- [ ] **Step 2: Update `frontend/src/style.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
@import './assets/design-system.css';
```

- [ ] **Step 3: Update `frontend/src/main.ts`**

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

- [ ] **Step 4: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/frontend/src/
git commit -m "feat: dark signal design system — css variables, fonts, utility classes"
git push
```

---

## Task 3: Types + API service layer

**Files:**
- Create: `frontend/src/types/agent.types.ts`
- Create: `frontend/src/types/analysis.types.ts`
- Create: `frontend/src/api/agents.ts`
- Create: `frontend/src/api/analysis.ts`
- Create: `frontend/src/api/kpi.ts`
- Create: `frontend/src/api/index.ts`

- [ ] **Step 1: Create `frontend/src/types/agent.types.ts`**

```typescript
export interface Agent {
  id: string
  ghlAgentId: string
  name: string
  script: string | null
  passRate: number | null
  totalCalls: number
  openUseActions: number
}
```

- [ ] **Step 2: Create `frontend/src/types/analysis.types.ts`**

```typescript
export interface KpiGoal {
  name: string
  description: string
  weight: number
}

export interface KpiScore {
  goal: string
  score: number
  passed: boolean
  evidence: string
}

export interface UseAction {
  id: string
  transcriptTurnIndex: number
  type: 'missed_opportunity' | 'deviation' | 'escalation_needed'
  description: string
}

export interface TranscriptTurn {
  speaker: 'agent' | 'user'
  text: string
  timestamp_ms: number
}

export interface AnalysisResult {
  id: string
  overallScore: number
  passed: boolean
  kpiScores: KpiScore[]
  summary: string
  analyzedAt: string
  transcriptId: string
  ghlCallId: string
  durationSeconds: number | null
  ingestedAt: string
  turns: TranscriptTurn[]
  useActions: UseAction[]
}

export interface KpiConfig {
  id: string
  agentId: string
  goals: KpiGoal[]
  successThreshold: number
  updatedAt: string
}
```

- [ ] **Step 3: Create `frontend/src/api/index.ts`**

```typescript
import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000',
  timeout: 15_000,
})
```

- [ ] **Step 4: Create `frontend/src/api/agents.ts`**

```typescript
import { api } from './index'
import { Agent } from '../types/agent.types'

export const agentsApi = {
  list: (locationId: string): Promise<Agent[]> =>
    api.get<Agent[]>('/api/agents', { params: { locationId } }).then((r) => r.data),
}
```

- [ ] **Step 5: Create `frontend/src/api/analysis.ts`**

```typescript
import { api } from './index'
import { AnalysisResult } from '../types/analysis.types'

export const analysisApi = {
  getByAgent: (agentId: string, locationId: string): Promise<AnalysisResult[]> =>
    api.get<AnalysisResult[]>(`/api/agents/${agentId}/analysis`, { params: { locationId } }).then((r) => r.data),
}
```

- [ ] **Step 6: Create `frontend/src/api/kpi.ts`**

```typescript
import { api } from './index'
import { KpiConfig, KpiGoal } from '../types/analysis.types'

export const kpiApi = {
  get: (agentId: string, locationId: string): Promise<KpiConfig> =>
    api.get<KpiConfig>(`/api/kpi/${agentId}`, { params: { locationId } }).then((r) => r.data),

  upsert: (agentId: string, locationId: string, goals: KpiGoal[], successThreshold: number): Promise<KpiConfig> =>
    api.put<KpiConfig>(`/api/kpi/${agentId}`, { goals, successThreshold }, { params: { locationId } }).then((r) => r.data),
}
```

- [ ] **Step 7: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/frontend/src/types/ voice-ai-copilot/frontend/src/api/
git commit -m "feat: frontend types and axios API service layer"
git push
```

---

## Task 4: Pinia stores + useSSE composable

**Files:**
- Create: `frontend/src/stores/agents.ts`
- Create: `frontend/src/stores/analysis.ts`
- Create: `frontend/src/stores/stream.ts`
- Create: `frontend/src/composables/useSSE.ts`
- Create: `frontend/src/stores/agents.test.ts`

- [ ] **Step 1: Write the failing store test**

```typescript
// frontend/src/stores/agents.test.ts
import { setActivePinia, createPinia } from 'pinia'
import { useAgentsStore } from './agents'
import { vi } from 'vitest'

vi.mock('../api/agents', () => ({
  agentsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 'ag-1', ghlAgentId: 'g-1', name: 'Alpha', script: null,
        passRate: 0.82, totalCalls: 12, openUseActions: 2 },
    ]),
  },
}))

describe('agentsStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('fetches agents and stores them', async () => {
    const store = useAgentsStore()
    expect(store.agents).toHaveLength(0)
    await store.fetchAll('loc-123')
    expect(store.agents).toHaveLength(1)
    expect(store.agents[0].name).toBe('Alpha')
    expect(store.loading).toBe(false)
  })

  it('sets loading to true while fetching', async () => {
    const store = useAgentsStore()
    const promise = store.fetchAll('loc-123')
    expect(store.loading).toBe(true)
    await promise
    expect(store.loading).toBe(false)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd voice-ai-copilot/frontend
npx vitest run src/stores/agents.test.ts
```

Expected: FAIL — `Cannot find module './agents'`

- [ ] **Step 3: Create `frontend/src/stores/agents.ts`**

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { agentsApi } from '../api/agents'
import { Agent } from '../types/agent.types'

export const useAgentsStore = defineStore('agents', () => {
  const agents = ref<Agent[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const locationId = ref<string | null>(null)

  async function fetchAll(locId: string): Promise<void> {
    locationId.value = locId
    loading.value = true
    error.value = null
    try {
      agents.value = await agentsApi.list(locId)
    } catch (e) {
      error.value = 'Failed to load agents'
    } finally {
      loading.value = false
    }
  }

  function getById(id: string): Agent | undefined {
    return agents.value.find((a) => a.id === id)
  }

  return { agents, loading, error, locationId, fetchAll, getById }
})
```

- [ ] **Step 4: Create `frontend/src/stores/analysis.ts`**

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { analysisApi } from '../api/analysis'
import { kpiApi } from '../api/kpi'
import { AnalysisResult, KpiConfig } from '../types/analysis.types'

export const useAnalysisStore = defineStore('analysis', () => {
  const resultsByAgent = ref<Record<string, AnalysisResult[]>>({})
  const kpiConfigs = ref<Record<string, KpiConfig>>({})
  const loading = ref(false)

  async function fetchResults(agentId: string, locationId: string): Promise<void> {
    loading.value = true
    try {
      resultsByAgent.value[agentId] = await analysisApi.getByAgent(agentId, locationId)
    } finally {
      loading.value = false
    }
  }

  async function fetchKpiConfig(agentId: string, locationId: string): Promise<void> {
    try {
      kpiConfigs.value[agentId] = await kpiApi.get(agentId, locationId)
    } catch {
      // No config yet — that's ok
    }
  }

  async function saveKpiConfig(
    agentId: string, locationId: string,
    goals: import('../types/analysis.types').KpiGoal[], successThreshold: number
  ): Promise<void> {
    kpiConfigs.value[agentId] = await kpiApi.upsert(agentId, locationId, goals, successThreshold)
  }

  function getResults(agentId: string): AnalysisResult[] {
    return resultsByAgent.value[agentId] ?? []
  }

  function getLatestResult(agentId: string): AnalysisResult | null {
    return resultsByAgent.value[agentId]?.[0] ?? null
  }

  return {
    resultsByAgent, kpiConfigs, loading,
    fetchResults, fetchKpiConfig, saveKpiConfig,
    getResults, getLatestResult,
  }
})
```

- [ ] **Step 5: Create `frontend/src/composables/useSSE.ts`**

```typescript
import { ref, onUnmounted } from 'vue'

export interface SSEEvent {
  type: 'analysis.complete' | 'analysis.failed' | 'transcript.ingested' | 'connected'
  agentId?: string
  locationId?: string
}

export function useSSE(locationId: string, onEvent: (event: SSEEvent) => void) {
  const connected = ref(false)
  let source: EventSource | null = null
  let retryDelay = 1000

  function connect() {
    source = new EventSource(`/stream?locationId=${encodeURIComponent(locationId)}`)

    source.onopen = () => {
      connected.value = true
      retryDelay = 1000  // reset backoff on successful connection
    }

    source.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as SSEEvent
        onEvent(event)
      } catch { /* malformed event — ignore */ }
    }

    source.onerror = () => {
      connected.value = false
      source?.close()
      source = null
      // Reconnect with exponential backoff (max 30s)
      setTimeout(connect, Math.min(retryDelay, 30_000))
      retryDelay = Math.min(retryDelay * 2, 30_000)
    }
  }

  connect()

  onUnmounted(() => {
    source?.close()
    source = null
  })

  return { connected }
}
```

- [ ] **Step 6: Create `frontend/src/stores/stream.ts`**

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useStreamStore = defineStore('stream', () => {
  const connected = ref(false)
  function setConnected(value: boolean) { connected.value = value }
  return { connected, setConnected }
})
```

- [ ] **Step 7: Run store tests**

```bash
npx vitest run src/stores/agents.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 8: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/frontend/src/stores/ voice-ai-copilot/frontend/src/composables/
git commit -m "feat: pinia stores for agents, analysis, stream + useSSE composable"
git push
```

---

## Task 5: Vue Router

**Files:**
- Create: `frontend/src/router/index.ts`
- Modify: `frontend/src/App.vue`

- [ ] **Step 1: Create `frontend/src/router/index.ts`**

```typescript
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
  },
  {
    path: '/agents/:id',
    name: 'AgentDetail',
    component: () => import('../views/AgentDetail.vue'),
    props: true,
  },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
```

- [ ] **Step 2: Update `frontend/src/App.vue`**

```vue
<template>
  <RouterView />
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>
```

- [ ] **Step 3: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/frontend/src/router/ voice-ai-copilot/frontend/src/App.vue
git commit -m "feat: vue router with Dashboard and AgentDetail routes"
git push
```

---

## Task 6: MetricCard + LiveIndicator components

**Files:**
- Create: `frontend/src/components/MetricCard.vue`
- Create: `frontend/src/components/LiveIndicator.vue`
- Create: `frontend/src/components/MetricCard.test.ts`

- [ ] **Step 1: Write the failing component test**

```typescript
// frontend/src/components/MetricCard.test.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import MetricCard from './MetricCard.vue'

describe('MetricCard', () => {
  it('renders label and value', () => {
    const wrapper = mount(MetricCard, {
      props: { label: 'PASS RATE', value: '68%' },
    })
    expect(wrapper.text()).toContain('PASS RATE')
    expect(wrapper.text()).toContain('68%')
  })

  it('renders null value as em dash', () => {
    const wrapper = mount(MetricCard, {
      props: { label: 'AVG SCORE', value: null },
    })
    expect(wrapper.text()).toContain('—')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run src/components/MetricCard.test.ts
```

Expected: FAIL — `Cannot find module './MetricCard.vue'`

- [ ] **Step 3: Create `frontend/src/components/MetricCard.vue`**

```vue
<template>
  <div class="metric-card">
    <span class="metric-label">{{ label }}</span>
    <span class="metric-value">{{ value ?? '—' }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  value: string | number | null
}>()
</script>

<style scoped>
.metric-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--space-4) var(--space-5);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  min-width: 140px;
}

.metric-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.metric-value {
  font-family: var(--font-mono);
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1;
}
</style>
```

- [ ] **Step 4: Create `frontend/src/components/LiveIndicator.vue`**

```vue
<template>
  <div class="live-indicator" :class="connected ? 'live' : 'offline'">
    <span class="dot" />
    <span class="label mono">{{ connected ? 'LIVE' : 'CONNECTING' }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{ connected: boolean }>()
</script>

<style scoped>
.live-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
}

.live .dot {
  background: var(--signal);
  box-shadow: 0 0 0 0 rgba(245,158,11, 0.4);
  animation: pulse 2s infinite;
}

.label {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
}

.live .label { color: var(--signal); }

@keyframes pulse {
  0%   { box-shadow: 0 0 0 0 rgba(245,158,11, 0.5); }
  70%  { box-shadow: 0 0 0 6px rgba(245,158,11, 0); }
  100% { box-shadow: 0 0 0 0 rgba(245,158,11, 0); }
}
</style>
```

- [ ] **Step 5: Run — expect PASS**

```bash
npx vitest run src/components/MetricCard.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/frontend/src/components/
git commit -m "feat: MetricCard and LiveIndicator components"
git push
```

---

## Task 7: AgentCard + KpiScoreBar components

**Files:**
- Create: `frontend/src/components/AgentCard.vue`
- Create: `frontend/src/components/KpiScoreBar.vue`
- Create: `frontend/src/components/AgentCard.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/components/AgentCard.test.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import AgentCard from './AgentCard.vue'
import type { Agent } from '../types/agent.types'

const router = createRouter({ history: createWebHistory(), routes: [{ path: '/', component: { template: '<div/>' } }] })

const passingAgent: Agent = { id: 'ag-1', ghlAgentId: 'g-1', name: 'Agent Alpha', script: null, passRate: 0.82, totalCalls: 12, openUseActions: 2 }
const failingAgent: Agent = { id: 'ag-2', ghlAgentId: 'g-2', name: 'Agent Beta',  script: null, passRate: 0.41, totalCalls: 9,  openUseActions: 7 }

describe('AgentCard', () => {
  it('shows green left border for passing agent', async () => {
    const wrapper = mount(AgentCard, { props: { agent: passingAgent }, global: { plugins: [router] } })
    expect(wrapper.find('.agent-card').classes()).toContain('passing')
  })

  it('shows red left border for failing agent', async () => {
    const wrapper = mount(AgentCard, { props: { agent: failingAgent }, global: { plugins: [router] } })
    expect(wrapper.find('.agent-card').classes()).toContain('failing')
  })

  it('renders agent name and call count', () => {
    const wrapper = mount(AgentCard, { props: { agent: passingAgent }, global: { plugins: [router] } })
    expect(wrapper.text()).toContain('Agent Alpha')
    expect(wrapper.text()).toContain('12')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run src/components/AgentCard.test.ts
```

Expected: FAIL — `Cannot find module './AgentCard.vue'`

- [ ] **Step 3: Create `frontend/src/components/AgentCard.vue`**

```vue
<template>
  <RouterLink :to="`/agents/${agent.id}`" class="agent-card-link">
    <div class="agent-card" :class="healthClass">
      <div class="agent-header">
        <span class="agent-name display">{{ agent.name }}</span>
        <span class="badge" :class="healthClass === 'passing' ? 'badge-pass' : 'badge-fail'">
          {{ healthClass === 'passing' ? 'PASSING' : 'FAILING' }}
        </span>
      </div>

      <div class="agent-pass-rate">
        <span class="rate-value mono">{{ passRateDisplay }}</span>
        <div class="rate-bar">
          <div class="rate-fill" :style="{ width: passRatePercent, background: healthColor }" />
        </div>
      </div>

      <div class="agent-meta">
        <span class="mono text-secondary">{{ agent.totalCalls }} calls</span>
        <span v-if="agent.openUseActions" class="badge badge-signal">
          ⚡ {{ agent.openUseActions }}
        </span>
      </div>
    </div>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Agent } from '../types/agent.types'

const props = defineProps<{ agent: Agent }>()

const healthClass = computed(() => {
  if (props.agent.passRate === null) return 'unknown'
  return props.agent.passRate >= 0.7 ? 'passing' : 'failing'
})

const healthColor = computed(() => {
  if (healthClass.value === 'passing') return 'var(--pass)'
  if (healthClass.value === 'failing') return 'var(--fail)'
  return 'var(--text-muted)'
})

const passRateDisplay = computed(() =>
  props.agent.passRate !== null ? `${Math.round(props.agent.passRate * 100)}%` : '—'
)

const passRatePercent = computed(() =>
  props.agent.passRate !== null ? `${props.agent.passRate * 100}%` : '0%'
)
</script>

<style scoped>
.agent-card-link { text-decoration: none; display: block; }

.agent-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-left: 3px solid var(--text-muted);
  border-radius: 8px;
  padding: var(--space-4) var(--space-5);
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.agent-card:hover { background: var(--bg-elevated); }
.agent-card.passing { border-left-color: var(--pass); }
.agent-card.failing { border-left-color: var(--fail); }

.agent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.agent-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.agent-pass-rate { display: flex; flex-direction: column; gap: 6px; }

.rate-value {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
}

.rate-bar {
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}

.rate-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 600ms ease;
}

.agent-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
```

- [ ] **Step 4: Create `frontend/src/components/KpiScoreBar.vue`**

```vue
<template>
  <div class="kpi-score-bar">
    <div class="kpi-header">
      <span class="kpi-name">{{ goal }}</span>
      <span class="badge" :class="passed ? 'badge-pass' : 'badge-fail'">
        {{ passed ? '✓' : '✗' }}
      </span>
    </div>
    <div class="kpi-bar-row">
      <div class="kpi-bar">
        <div
          class="kpi-fill"
          :style="{ width: `${score * 100}%`, background: passed ? 'var(--pass)' : 'var(--fail)' }"
        />
      </div>
      <span class="kpi-score mono">{{ (score * 100).toFixed(0) }}</span>
    </div>
    <p v-if="evidence" class="kpi-evidence text-muted">{{ evidence }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  goal: string
  score: number
  passed: boolean
  evidence?: string
}>()
</script>

<style scoped>
.kpi-score-bar { display: flex; flex-direction: column; gap: var(--space-2); }
.kpi-header { display: flex; justify-content: space-between; align-items: center; }
.kpi-name { font-size: 13px; color: var(--text-primary); }
.kpi-bar-row { display: flex; align-items: center; gap: var(--space-2); }
.kpi-bar { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
.kpi-fill { height: 100%; border-radius: 3px; transition: width 500ms ease; }
.kpi-score { font-size: 12px; color: var(--text-secondary); min-width: 28px; text-align: right; }
.kpi-evidence { font-size: 12px; line-height: 1.4; }
</style>
```

- [ ] **Step 5: Run — expect PASS**

```bash
npx vitest run src/components/AgentCard.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/frontend/src/components/
git commit -m "feat: AgentCard with health state and KpiScoreBar components"
git push
```

---

## Task 8: UseActionBadge + TranscriptViewer components

**Files:**
- Create: `frontend/src/components/UseActionBadge.vue`
- Create: `frontend/src/components/TranscriptViewer.vue`
- Create: `frontend/src/components/TranscriptViewer.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/components/TranscriptViewer.test.ts
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import TranscriptViewer from './TranscriptViewer.vue'
import type { TranscriptTurn, UseAction } from '../types/analysis.types'

const turns: TranscriptTurn[] = [
  { speaker: 'agent', text: 'Hi, can I book you for 3pm?', timestamp_ms: 0 },
  { speaker: 'user',  text: 'Sure, that works.', timestamp_ms: 3000 },
  { speaker: 'agent', text: 'Great, have a good day!', timestamp_ms: 6000 },
]

const useActions: UseAction[] = [
  { id: 'ua-1', transcriptTurnIndex: 2, type: 'missed_opportunity', description: 'Did not confirm contact number' },
]

describe('TranscriptViewer', () => {
  it('renders all turns', () => {
    const wrapper = mount(TranscriptViewer, { props: { turns, useActions: [] } })
    expect(wrapper.findAll('.turn')).toHaveLength(3)
  })

  it('renders a UseActionBadge after the flagged turn', () => {
    const wrapper = mount(TranscriptViewer, { props: { turns, useActions } })
    expect(wrapper.findAll('.use-action-badge')).toHaveLength(1)
    expect(wrapper.text()).toContain('Did not confirm contact number')
  })

  it('labels agent turns differently from user turns', () => {
    const wrapper = mount(TranscriptViewer, { props: { turns, useActions: [] } })
    const speakers = wrapper.findAll('.turn-speaker')
    expect(speakers[0].classes()).toContain('agent')
    expect(speakers[1].classes()).toContain('user')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run src/components/TranscriptViewer.test.ts
```

Expected: FAIL — `Cannot find module './TranscriptViewer.vue'`

- [ ] **Step 3: Create `frontend/src/components/UseActionBadge.vue`**

```vue
<template>
  <div class="use-action-badge">
    <span class="ua-type mono">⚡ {{ typeLabel }}</span>
    <p class="ua-description">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  type: 'missed_opportunity' | 'deviation' | 'escalation_needed'
  description: string
}>()

const typeLabel = computed(() => ({
  missed_opportunity: 'MISSED OPPORTUNITY',
  deviation: 'DEVIATION',
  escalation_needed: 'ESCALATION NEEDED',
}[props.type]))
</script>

<style scoped>
.use-action-badge {
  margin: var(--space-2) 0;
  border-left: 3px solid var(--signal);
  padding: var(--space-2) var(--space-4);
  background: rgba(245, 158, 11, 0.06);
  border-radius: 0 4px 4px 0;
  animation: slide-in 280ms ease-out;
}

.ua-type {
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--signal);
  display: block;
  margin-bottom: 2px;
}

.ua-description {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}

@keyframes slide-in {
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
}
</style>
```

- [ ] **Step 4: Create `frontend/src/components/TranscriptViewer.vue`**

```vue
<template>
  <div class="transcript-viewer">
    <template v-for="(turn, index) in turns" :key="index">
      <div class="turn">
        <span class="turn-timestamp mono">{{ formatMs(turn.timestamp_ms) }}</span>
        <span class="turn-speaker mono" :class="turn.speaker">{{ turn.speaker.toUpperCase() }}</span>
        <p class="turn-text">{{ turn.text }}</p>
      </div>
      <UseActionBadge
        v-for="ua in useActionsAt(index)"
        :key="ua.id"
        :type="ua.type"
        :description="ua.description"
        class="use-action-badge"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import UseActionBadge from './UseActionBadge.vue'
import type { TranscriptTurn, UseAction } from '../types/analysis.types'

const props = defineProps<{
  turns: TranscriptTurn[]
  useActions: UseAction[]
}>()

function useActionsAt(index: number): UseAction[] {
  return props.useActions.filter((ua) => ua.transcriptTurnIndex === index)
}

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60).toString().padStart(2, '0')
  const s = (total % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}
</script>

<style scoped>
.transcript-viewer {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.turn {
  display: grid;
  grid-template-columns: 36px 56px 1fr;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border);
  align-items: start;
}

.turn-timestamp {
  font-size: 10px;
  color: var(--text-muted);
  padding-top: 2px;
}

.turn-speaker {
  font-size: 11px;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  padding-top: 2px;
}

.turn-speaker.agent { color: var(--signal); }
.turn-speaker.user  { color: var(--info); }

.turn-text {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
}
</style>
```

- [ ] **Step 5: Run — expect PASS**

```bash
npx vitest run src/components/TranscriptViewer.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/frontend/src/components/
git commit -m "feat: UseActionBadge and TranscriptViewer with inline flagged turns"
git push
```

---

## Task 9: RecommendationPanel + KpiConfigEditor components

**Files:**
- Create: `frontend/src/components/RecommendationPanel.vue`
- Create: `frontend/src/components/KpiConfigEditor.vue`

- [ ] **Step 1: Create `frontend/src/components/RecommendationPanel.vue`**

```vue
<template>
  <div class="recommendation-panel">
    <h3 class="panel-title display">RECOMMENDATIONS</h3>
    <div v-if="!recommendations.length" class="empty text-muted mono">
      No recommendations yet
    </div>
    <div
      v-for="rec in sortedRecs"
      :key="`${rec.goal}-${rec.score}`"
      class="rec-card"
      :class="`priority-${priority(rec)}`"
    >
      <div class="rec-header">
        <span class="rec-priority mono">{{ priority(rec).toUpperCase() }}</span>
        <span class="rec-type mono text-muted">{{ rec.goal }}</span>
      </div>
      <p class="rec-body">{{ rec.evidence }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { KpiScore } from '../types/analysis.types'

const props = defineProps<{ recommendations: KpiScore[] }>()

function priority(rec: KpiScore): 'high' | 'medium' | 'low' {
  if (rec.score < 0.4) return 'high'
  if (rec.score < 0.7) return 'medium'
  return 'low'
}

const sortedRecs = computed(() =>
  [...props.recommendations]
    .filter((r) => !r.passed)
    .sort((a, b) => a.score - b.score)
)
</script>

<style scoped>
.recommendation-panel { display: flex; flex-direction: column; gap: var(--space-3); }

.panel-title {
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  margin-bottom: var(--space-1);
}

.empty { font-size: 12px; padding: var(--space-4) 0; }

.rec-card {
  border: 1px solid var(--border);
  border-top-width: 2px;
  border-radius: 6px;
  padding: var(--space-3) var(--space-4);
}

.rec-card.priority-high   { border-top-color: var(--fail); }
.rec-card.priority-medium { border-top-color: var(--warning); }
.rec-card.priority-low    { border-top-color: var(--info); }

.rec-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.rec-priority { font-size: 10px; letter-spacing: 0.1em; color: var(--text-secondary); }
.rec-type     { font-size: 10px; }
.rec-body     { font-size: 13px; color: var(--text-primary); line-height: 1.5; }
</style>
```

- [ ] **Step 2: Create `frontend/src/components/KpiConfigEditor.vue`**

```vue
<template>
  <div class="kpi-editor">
    <button class="toggle-btn mono" @click="open = !open">
      {{ open ? '▲' : '▼' }} KPI CONFIGURATION
    </button>

    <div v-if="open" class="editor-body">
      <div class="goals-list">
        <div v-for="(goal, i) in localGoals" :key="i" class="goal-row">
          <input v-model="goal.name" class="goal-input" placeholder="Goal name" />
          <input v-model.number="goal.weight" type="number" min="0" max="1" step="0.05" class="weight-input mono" />
          <input v-model="goal.description" class="desc-input" placeholder="What does success look like?" />
          <button class="remove-btn" @click="removeGoal(i)">✕</button>
        </div>
      </div>

      <button class="add-btn" @click="addGoal">+ Add Goal</button>

      <div class="threshold-row">
        <label class="mono">Pass threshold</label>
        <input v-model.number="localThreshold" type="number" min="0" max="1" step="0.05" class="weight-input mono" />
      </div>

      <button class="save-btn" :disabled="saving" @click="save">
        {{ saving ? 'Saving...' : 'Save Configuration' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { KpiGoal } from '../types/analysis.types'

const props = defineProps<{
  agentId: string
  locationId: string
  initialGoals: KpiGoal[]
  initialThreshold: number
}>()

const emit = defineEmits<{
  save: [goals: KpiGoal[], threshold: number]
}>()

const open = ref(false)
const saving = ref(false)
const localGoals = ref<KpiGoal[]>(props.initialGoals.map((g) => ({ ...g })))
const localThreshold = ref(props.initialThreshold)

watch(() => props.initialGoals, (val) => {
  localGoals.value = val.map((g) => ({ ...g }))
})

function addGoal() {
  localGoals.value.push({ name: '', description: '', weight: 0 })
}

function removeGoal(index: number) {
  localGoals.value.splice(index, 1)
}

async function save() {
  saving.value = true
  try {
    emit('save', localGoals.value, localThreshold.value)
  } finally {
    saving.value = false
    open.value = false
  }
}
</script>

<style scoped>
.kpi-editor { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }

.toggle-btn {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: var(--bg-surface);
  border: none;
  color: var(--text-secondary);
  font-size: 11px;
  letter-spacing: 0.08em;
  cursor: pointer;
  text-align: left;
}

.toggle-btn:hover { background: var(--bg-elevated); color: var(--text-primary); }

.editor-body {
  padding: var(--space-4);
  background: var(--bg-surface);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  border-top: 1px solid var(--border);
}

.goal-row { display: grid; grid-template-columns: 1fr 60px 2fr 24px; gap: var(--space-2); align-items: center; }

input {
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: var(--space-2) var(--space-3);
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 13px;
}

input:focus { outline: none; border-color: var(--signal); }

.weight-input { font-family: var(--font-mono); font-size: 13px; }

.threshold-row { display: flex; align-items: center; justify-content: space-between; }
.threshold-row label { font-size: 12px; color: var(--text-secondary); }

.add-btn, .save-btn, .remove-btn {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-3);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-family: var(--font-ui);
}

.save-btn { background: var(--signal); color: #000; border-color: var(--signal); font-weight: 500; }
.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.remove-btn { border: none; padding: 0 4px; font-size: 14px; }
</style>
```

- [ ] **Step 3: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/frontend/src/components/
git commit -m "feat: RecommendationPanel and KpiConfigEditor components"
git push
```

---

## Task 10: Dashboard.vue

**Files:**
- Create: `frontend/src/views/Dashboard.vue`

- [ ] **Step 1: Create `frontend/src/views/Dashboard.vue`**

```vue
<template>
  <div class="dashboard">
    <header class="dash-header">
      <div class="header-left">
        <h1 class="display">VOICE AI COPILOT</h1>
        <svg class="signal-wave" :class="{ disconnected: !streamStore.connected }" viewBox="0 0 80 24" fill="none">
          <path d="M0 12 Q10 4 20 12 Q30 20 40 12 Q50 4 60 12 Q70 20 80 12" stroke="var(--signal)" stroke-width="2" fill="none"/>
        </svg>
      </div>
      <div class="header-right">
        <LiveIndicator :connected="streamStore.connected" />
      </div>
    </header>

    <div class="metrics-row">
      <MetricCard label="TOTAL CALLS" :value="totalCalls" />
      <MetricCard label="PASS RATE" :value="passRate" />
      <MetricCard label="AVG SCORE" :value="avgScore" />
      <MetricCard label="USE ACTIONS" :value="openUseActions" />
    </div>

    <section class="agents-section">
      <h2 class="section-title mono">AGENTS</h2>
      <div v-if="agentsStore.loading" class="loading mono text-muted">Loading agents...</div>
      <div v-else class="agents-grid">
        <AgentCard
          v-for="(agent, i) in agentsStore.agents"
          :key="agent.id"
          :agent="agent"
          :style="{ animationDelay: `${i * 60}ms` }"
          class="agent-reveal"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAgentsStore } from '../stores/agents'
import { useStreamStore } from '../stores/stream'
import { useAnalysisStore } from '../stores/analysis'
import { useSSE } from '../composables/useSSE'
import MetricCard from '../components/MetricCard.vue'
import LiveIndicator from '../components/LiveIndicator.vue'
import AgentCard from '../components/AgentCard.vue'

// In production, locationId comes from GHL via postMessage.
// For dev, read from URL param.
const locationId = new URLSearchParams(window.location.search).get('locationId') ?? 'dev-loc'

const agentsStore = useAgentsStore()
const streamStore = useStreamStore()
const analysisStore = useAnalysisStore()

const { connected } = useSSE(locationId, (event) => {
  streamStore.setConnected(true)
  if (event.type === 'analysis.complete' && event.agentId) {
    agentsStore.fetchAll(locationId)
    analysisStore.fetchResults(event.agentId, locationId)
  }
})

streamStore.setConnected(connected.value)

onMounted(() => agentsStore.fetchAll(locationId))

const totalCalls = computed(() =>
  agentsStore.agents.reduce((s, a) => s + a.totalCalls, 0)
)

const passRate = computed(() => {
  const rates = agentsStore.agents.filter((a) => a.passRate !== null).map((a) => a.passRate!)
  if (!rates.length) return null
  return `${Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100)}%`
})

const avgScore = computed(() => {
  const rates = agentsStore.agents.filter((a) => a.passRate !== null).map((a) => a.passRate!)
  if (!rates.length) return null
  return (rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(2)
})

const openUseActions = computed(() =>
  agentsStore.agents.reduce((s, a) => s + a.openUseActions, 0)
)
</script>

<style scoped>
.dashboard { padding: var(--space-6); max-width: 1200px; margin: 0 auto; }

.dash-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--border);
}

.header-left { display: flex; align-items: center; gap: var(--space-4); }

h1 { font-size: 18px; font-weight: 800; letter-spacing: 0.12em; color: var(--text-primary); }

.signal-wave { width: 64px; height: 20px; opacity: 0.7; }
.signal-wave:not(.disconnected) { animation: breathe 2.4s ease-in-out infinite; }
.signal-wave.disconnected { opacity: 0.15; }

@keyframes breathe {
  0%, 100% { opacity: 0.4; transform: scaleY(1); }
  50%       { opacity: 0.9; transform: scaleY(1.3); }
}

.metrics-row {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-8);
  flex-wrap: wrap;
}

.section-title {
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  margin-bottom: var(--space-4);
}

.agents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-4);
}

.agent-reveal {
  animation: reveal 400ms ease-out both;
}

@keyframes reveal {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

.loading { padding: var(--space-6) 0; }
</style>
```

- [ ] **Step 2: Verify dashboard renders**

```bash
npm run dev
```

Open `http://localhost:5173?locationId=your-loc-id`. Expected: Dashboard renders with metric cards and agent grid (or empty state if no seed data yet).

- [ ] **Step 3: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/frontend/src/views/Dashboard.vue
git commit -m "feat: Dashboard view with metrics, agent grid, SSE live updates, and breathing waveform"
git push
```

---

## Task 11: AgentDetail.vue

**Files:**
- Create: `frontend/src/views/AgentDetail.vue`

- [ ] **Step 1: Create `frontend/src/views/AgentDetail.vue`**

```vue
<template>
  <div class="agent-detail">
    <header class="detail-header">
      <RouterLink to="/" class="back-link mono">← AGENTS</RouterLink>
      <h1 class="display">{{ agent?.name ?? 'Loading...' }}</h1>
      <LiveIndicator :connected="streamStore.connected" />
    </header>

    <div class="detail-grid" v-if="latestResult">
      <!-- Left: Call history -->
      <section class="panel calls-panel">
        <h2 class="panel-title mono">CALLS</h2>
        <div class="calls-list">
          <div
            v-for="result in results"
            :key="result.id"
            class="call-item"
            :class="{ selected: selectedResult?.id === result.id, pass: result.passed, fail: !result.passed }"
            @click="selectedResult = result"
          >
            <span class="mono text-muted">{{ formatDate(result.analyzedAt) }}</span>
            <span class="badge" :class="result.passed ? 'badge-pass' : 'badge-fail'">
              {{ result.passed ? 'PASS' : 'FAIL' }}
            </span>
            <span class="mono text-secondary">{{ result.durationSeconds }}s</span>
          </div>
        </div>
      </section>

      <!-- Center: KPI Scorecard -->
      <section class="panel kpi-panel">
        <h2 class="panel-title mono">KPI SCORECARD</h2>
        <div class="kpi-scores">
          <KpiScoreBar
            v-for="score in selectedResult?.kpiScores ?? []"
            :key="score.goal"
            :goal="score.goal"
            :score="score.score"
            :passed="score.passed"
            :evidence="score.evidence"
          />
        </div>
        <div class="overall-score surface">
          <span class="mono text-muted">OVERALL</span>
          <span class="mono overall-value">{{ ((selectedResult?.overallScore ?? 0) * 100).toFixed(0) }}</span>
          <span class="badge" :class="selectedResult?.passed ? 'badge-pass' : 'badge-fail'">
            {{ selectedResult?.passed ? 'PASSING' : 'FAILING' }}
          </span>
        </div>
        <KpiConfigEditor
          :agentId="id"
          :locationId="locationId"
          :initialGoals="kpiConfig?.goals ?? []"
          :initialThreshold="kpiConfig?.successThreshold ?? 0.7"
          @save="handleKpiSave"
        />
      </section>

      <!-- Right: Recommendations -->
      <section class="panel recs-panel">
        <RecommendationPanel :recommendations="selectedResult?.kpiScores ?? []" />
      </section>
    </div>

    <!-- Transcript Viewer -->
    <section v-if="selectedResult" class="transcript-section surface">
      <h2 class="panel-title mono">TRANSCRIPT — {{ selectedResult.ghlCallId }}</h2>
      <TranscriptViewer
        :turns="selectedResult.turns"
        :useActions="selectedResult.useActions"
      />
    </section>

    <div v-else class="empty mono text-muted">No analysis results yet for this agent.</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAgentsStore } from '../stores/agents'
import { useAnalysisStore } from '../stores/analysis'
import { useStreamStore } from '../stores/stream'
import { useSSE } from '../composables/useSSE'
import LiveIndicator from '../components/LiveIndicator.vue'
import KpiScoreBar from '../components/KpiScoreBar.vue'
import RecommendationPanel from '../components/RecommendationPanel.vue'
import TranscriptViewer from '../components/TranscriptViewer.vue'
import KpiConfigEditor from '../components/KpiConfigEditor.vue'
import type { AnalysisResult, KpiGoal } from '../types/analysis.types'

const props = defineProps<{ id: string }>()

const locationId = new URLSearchParams(window.location.search).get('locationId') ?? 'dev-loc'

const agentsStore = useAgentsStore()
const analysisStore = useAnalysisStore()
const streamStore = useStreamStore()

const selectedResult = ref<AnalysisResult | null>(null)

const agent = computed(() => agentsStore.getById(props.id))
const results = computed(() => analysisStore.getResults(props.id))
const latestResult = computed(() => analysisStore.getLatestResult(props.id))
const kpiConfig = computed(() => analysisStore.kpiConfigs[props.id])

useSSE(locationId, (event) => {
  if (event.type === 'analysis.complete' && event.agentId === props.id) {
    analysisStore.fetchResults(props.id, locationId)
  }
})

onMounted(async () => {
  await Promise.all([
    agentsStore.fetchAll(locationId),
    analysisStore.fetchResults(props.id, locationId),
    analysisStore.fetchKpiConfig(props.id, locationId),
  ])
  selectedResult.value = latestResult.value
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
}

async function handleKpiSave(goals: KpiGoal[], threshold: number) {
  await analysisStore.saveKpiConfig(props.id, locationId, goals, threshold)
}
</script>

<style scoped>
.agent-detail { padding: var(--space-6); max-width: 1400px; margin: 0 auto; }

.detail-header {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--border);
}

.back-link {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  text-decoration: none;
}
.back-link:hover { color: var(--text-primary); }

h1 { font-size: 18px; font-weight: 700; flex: 1; }

.detail-grid {
  display: grid;
  grid-template-columns: 200px 1fr 260px;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.panel {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.panel-title {
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  margin-bottom: var(--space-2);
}

.calls-list { display: flex; flex-direction: column; gap: var(--space-2); overflow-y: auto; max-height: 400px; }

.call-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-2) var(--space-3);
  border-radius: 4px;
  cursor: pointer;
  border-left: 2px solid transparent;
}

.call-item:hover { background: var(--bg-elevated); }
.call-item.selected { background: var(--bg-elevated); border-left-color: var(--signal); }
.call-item.pass { border-left-color: var(--pass); }
.call-item.fail { border-left-color: var(--fail); }

.kpi-scores { display: flex; flex-direction: column; gap: var(--space-4); }

.overall-score {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  margin-top: var(--space-2);
}

.overall-value { font-size: 24px; font-weight: 600; }

.transcript-section {
  padding: var(--space-5);
}

.empty { padding: var(--space-8) 0; font-size: 13px; }
</style>
```

- [ ] **Step 2: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/frontend/src/views/AgentDetail.vue
git commit -m "feat: AgentDetail view — KPI scorecard, recommendations, transcript viewer"
git push
```

---

## Task 12: GHL widget

**Files:**
- Create: `voice-ai-copilot/widget/inject.js`
- Create: `voice-ai-copilot/widget/iframe-host.html`

- [ ] **Step 1: Create `widget/inject.js`**

```javascript
;(function () {
  'use strict'

  // Read locationId from GHL's global context or URL
  function getLocationId() {
    try {
      return window.location.hostname.split('.')[0]
        || new URLSearchParams(window.location.search).get('locationId')
        || 'unknown'
    } catch {
      return 'unknown'
    }
  }

  function injectCopilot() {
    if (document.getElementById('voice-ai-copilot-widget')) return

    const locationId = getLocationId()

    const container = document.createElement('div')
    container.id = 'voice-ai-copilot-widget'
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 420px;
      height: 600px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 24px 64px rgba(0,0,0,0.6);
      z-index: 99999;
      display: none;
    `

    const iframe = document.createElement('iframe')
    iframe.src = `https://your-copilot-domain.com?locationId=${encodeURIComponent(locationId)}`
    iframe.style.cssText = 'width: 100%; height: 100%; border: none;'
    iframe.allow = 'clipboard-write'

    const toggleBtn = document.createElement('button')
    toggleBtn.id = 'voice-ai-copilot-toggle'
    toggleBtn.textContent = '⚡ Voice AI'
    toggleBtn.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #F59E0B;
      color: #000;
      border: none;
      border-radius: 8px;
      padding: 10px 18px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      z-index: 99999;
      font-family: 'DM Sans', sans-serif;
      box-shadow: 0 4px 16px rgba(245,158,11,0.4);
    `

    let open = false
    toggleBtn.addEventListener('click', () => {
      open = !open
      container.style.display = open ? 'block' : 'none'
      toggleBtn.style.display = open ? 'none' : 'block'
    })

    container.appendChild(iframe)
    document.body.appendChild(container)
    document.body.appendChild(toggleBtn)

    // Pass locationId into iframe via postMessage after load
    iframe.addEventListener('load', () => {
      iframe.contentWindow?.postMessage({ type: 'ghl-context', locationId }, '*')
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectCopilot)
  } else {
    injectCopilot()
  }
})()
```

- [ ] **Step 2: Create `widget/iframe-host.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Voice AI Copilot</title>
  <script>
    // Receive locationId from parent GHL frame
    window.addEventListener('message', function (event) {
      if (event.data?.type === 'ghl-context' && event.data.locationId) {
        const url = new URL(window.location.href)
        url.searchParams.set('locationId', event.data.locationId)
        // Reload the Vue app with the correct locationId
        if (!url.searchParams.has('loaded')) {
          url.searchParams.set('loaded', '1')
          window.location.replace(url.toString())
        }
      }
    })
  </script>
</head>
<body style="margin:0;padding:0;background:#0A0B0E">
  <!-- The Vue app is served at / and embedded here -->
  <script>
    // If no locationId in URL yet, wait for postMessage
    const params = new URLSearchParams(window.location.search)
    if (params.get('locationId')) {
      // Load the Vue app inline
      const iframe = document.createElement('iframe')
      iframe.src = '/?locationId=' + encodeURIComponent(params.get('locationId'))
      iframe.style.cssText = 'width:100%;height:100vh;border:none;'
      document.body.appendChild(iframe)
    }
  </script>
</body>
</html>
```

- [ ] **Step 3: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/widget/
git commit -m "feat: GHL custom JS widget (inject.js) and iframe host"
git push
```

---

## Task 13: Seed data

**Files:**
- Create: `backend/src/db/seed.ts`

- [ ] **Step 1: Create `backend/src/db/seed.ts`**

```typescript
import { Pool } from 'pg'
import { config } from '../config'

const pool = new Pool({ connectionString: config.databaseUrl })

const LOCATION_ID = 'demo-location-001'
const AGENTS = [
  { ghl_id: 'agent-alpha', name: 'Agent Alpha', script: 'You are a booking agent for Sunrise Dental. Your goal is to book new patient appointments, qualify insurance, and handle objections professionally.' },
  { ghl_id: 'agent-beta',  name: 'Agent Beta',  script: 'You are a lead qualification agent for Summit Real Estate. Qualify buyers by budget, timeline, and location preference.' },
  { ghl_id: 'agent-gamma', name: 'Agent Gamma', script: 'You are a follow-up agent for TechPro Services. Re-engage cold leads and book demo calls.' },
]

const KPI_CONFIGS = [
  { goals: [{ name: 'Book Appointment', description: 'Confirm date and time', weight: 0.5 }, { name: 'Qualify Insurance', description: 'Confirm insurance accepted', weight: 0.3 }, { name: 'Handle Objection', description: 'Address at least one concern', weight: 0.2 }], threshold: 0.70 },
  { goals: [{ name: 'Qualify Budget', description: 'Confirm budget range', weight: 0.4 }, { name: 'Confirm Timeline', description: 'Ask about move-in timeline', weight: 0.3 }, { name: 'Location Preference', description: 'Get area preferences', weight: 0.3 }], threshold: 0.65 },
  { goals: [{ name: 'Re-engage Lead', description: 'Get lead interested again', weight: 0.4 }, { name: 'Book Demo Call', description: 'Schedule a demo', weight: 0.6 }], threshold: 0.70 },
]

function randomTurns(passed: boolean): object[] {
  const base = [
    { speaker: 'agent', text: 'Hi there! Am I speaking with the right person?', timestamp_ms: 0 },
    { speaker: 'user',  text: 'Yes, this is them. Who is this?', timestamp_ms: 3000 },
    { speaker: 'agent', text: 'Great! I\'m calling from our office. Do you have a moment?', timestamp_ms: 6000 },
    { speaker: 'user',  text: 'Sure, go ahead.', timestamp_ms: 9000 },
  ]
  if (passed) {
    return [...base,
      { speaker: 'agent', text: 'Wonderful! I can get you scheduled for Tuesday at 2pm — does that work?', timestamp_ms: 12000 },
      { speaker: 'user',  text: 'That works perfectly.', timestamp_ms: 15000 },
      { speaker: 'agent', text: 'Perfect, you\'re all set! We\'ll send a confirmation shortly.', timestamp_ms: 18000 },
    ]
  }
  return [...base,
    { speaker: 'agent', text: 'We have some great options available...', timestamp_ms: 12000 },
    { speaker: 'user',  text: 'Can you call me later? I\'m busy.', timestamp_ms: 15000 },
    { speaker: 'agent', text: 'Of course, have a great day!', timestamp_ms: 18000 },
  ]
}

async function seed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Upsert location
    await client.query(
      `INSERT INTO locations (location_id, name) VALUES ($1, $2)
       ON CONFLICT (location_id) DO NOTHING`,
      [LOCATION_ID, 'Demo Agency']
    )

    for (let i = 0; i < AGENTS.length; i++) {
      const ag = AGENTS[i]
      const kpi = KPI_CONFIGS[i]

      // Upsert agent
      const { rows: [agent] } = await client.query(
        `INSERT INTO agents (location_id, ghl_agent_id, name, script)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (location_id, ghl_agent_id) DO UPDATE SET name = $3, script = $4
         RETURNING id`,
        [LOCATION_ID, ag.ghl_id, ag.name, ag.script]
      )

      // Upsert KPI config
      const { rows: [kpiRow] } = await client.query(
        `INSERT INTO kpi_configs (agent_id, goals, success_threshold)
         VALUES ($1, $2, $3)
         ON CONFLICT (agent_id) DO UPDATE SET goals = $2, success_threshold = $3, updated_at = NOW()
         RETURNING id`,
        [agent.id, JSON.stringify(kpi.goals), kpi.threshold]
      )

      // Seed 20 transcripts per agent
      for (let j = 0; j < 20; j++) {
        const passed = j % 3 !== 0  // ~67% pass rate
        const score = passed ? 0.65 + Math.random() * 0.3 : 0.2 + Math.random() * 0.35
        const callId = `call-${ag.ghl_id}-${j.toString().padStart(3, '0')}`

        const { rows: [transcript] } = await client.query(
          `INSERT INTO transcripts (agent_id, location_id, ghl_call_id, duration_seconds, status, turns)
           VALUES ($1, $2, $3, $4, 'analyzed', $5)
           ON CONFLICT (ghl_call_id) DO NOTHING
           RETURNING id`,
          [agent.id, LOCATION_ID, callId, 45 + Math.floor(Math.random() * 90), JSON.stringify(randomTurns(passed))]
        )
        if (!transcript) continue

        const { rows: [analysis] } = await client.query(
          `INSERT INTO analysis_results (transcript_id, kpi_config_id, overall_score, passed, kpi_scores, summary, llm_provider, llm_model)
           VALUES ($1, $2, $3, $4, $5, $6, 'openai', 'gpt-4o') RETURNING id`,
          [
            transcript.id,
            kpiRow.id,
            score.toFixed(2),
            passed,
            JSON.stringify(kpi.goals.map((g: { name: string }) => ({
              goal: g.name, score: (score + (Math.random() - 0.5) * 0.2).toFixed(2),
              passed, evidence: passed ? 'Addressed successfully.' : 'Not addressed in the call.',
            }))),
            passed ? 'Agent performed well against KPI targets.' : 'Agent missed key objectives this call.',
          ]
        )

        // Add use actions to 1 in 4 calls
        if (!passed && j % 4 === 0) {
          await client.query(
            `INSERT INTO use_actions (analysis_id, transcript_turn_index, type, description)
             VALUES ($1, 5, 'missed_opportunity', 'Agent did not attempt to re-book when user said they were busy.')`,
            [analysis.id]
          )
        }
      }
    }

    await client.query('COMMIT')
    console.log('✓ Seed complete — 3 agents, 60 transcripts, analyses, and use actions')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Run the seed**

```bash
cd voice-ai-copilot
make migrate
make seed
```

Expected: `✓ Seed complete — 3 agents, 60 transcripts, analyses, and use actions`

- [ ] **Step 3: Verify dashboard shows data**

```bash
make dev
```

Open `http://localhost:5173?locationId=demo-location-001`. Expected: 3 agent cards with pass rates, metric row populated.

- [ ] **Step 4: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/backend/src/db/seed.ts
git commit -m "feat: seed data — 3 agents, 60 transcripts with analyses and use actions"
git push
```

---

## Task 14: README + CHANGELOG

**Files:**
- Create: `voice-ai-copilot/README.md`
- Create: `voice-ai-copilot/CHANGELOG.md`

- [ ] **Step 1: Create `voice-ai-copilot/README.md`**

```markdown
# Voice AI Observability Copilot

An Agent Observability Copilot that automates the "Monitor" and "Analyze" phases for HighLevel Voice AI agents.

## Architecture

```
GHL Webhook → Express handler (HMAC verified) → Temporal workflow
  → Load transcript + KPI config
  → Build LLM prompt
  → Call LLM (OpenAI or Anthropic, retried on rate limit)
  → Persist analysis results + use actions
  → SSE broadcast → Vue dashboard updates live
```

**Stack:** Node.js + TypeScript, Express, Temporal, PostgreSQL, Redis, Vue 3 + Pinia, TailwindCSS

## What Is Real vs Mocked

| Feature | Status |
|---|---|
| GHL webhook handler | Real — HMAC-SHA256 verified, idempotent |
| Transcript ingestion | Real |
| LLM analysis pipeline | Real — OpenAI or Anthropic via env var |
| SSE live updates | Real |
| Seed data | Mocked — 3 agents, 60 transcripts |
| GHL OAuth flow | Architecture-ready — upgrade path below |

## Prerequisites

- Docker Desktop
- Node.js 20+
- Temporal CLI (for local dev): `brew install temporal` or `choco install temporal`

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/hemant-taneja/voice-ai-observability-copilot
cd voice-ai-copilot
cp .env.example .env
# Fill in OPENAI_API_KEY (or ANTHROPIC_API_KEY) and GHL_WEBHOOK_SECRET

# 2. Start infrastructure
make infra

# 3. Run migrations + seed demo data
make migrate
make seed

# 4. Start backend + frontend
make dev

# 5. Open dashboard
# http://localhost:5173?locationId=demo-location-001
# Temporal UI: http://localhost:8080
```

## GHL Integration

**Custom JS Widget (demo mode):**
Paste `widget/inject.js` into GHL Settings → Custom JS. Update the iframe src to your deployed URL.

**Marketplace App (upgrade path):**
1. Register app at developers.gohighlevel.com
2. Add OAuth callback to `POST /auth/callback` → stores tokens in `locations` table
3. In `ghl-auth.ts`, replace query-param `locationId` with signed GHL iframe header

## Architecture Notes — Approach 3 Upgrade

The current pipeline is a linear Temporal workflow (Approach 2). To upgrade to an explicit event-driven pipeline (Approach 3):

- Split `analyze-call.workflow.ts` into three chained workflows: `IngestWorkflow → AnalysisWorkflow → RecommendationWorkflow`
- Each workflow is independently retryable and visible in the Temporal UI
- No changes required to routes, services, or frontend

This upgrade touches only `src/workflows/` — the rest of the system is unchanged.

## Team of One

This project was designed and implemented as a "Team of One" owning Product, Design, Engineering, and QA:

- **Product:** Assignment requirements mapped to Monitor + Analyze loops with a clear real vs mocked distinction
- **Design:** Dark Signal aesthetic — deliberate, distinctive, not generic AI tooling
- **Engineering:** Temporal for durable LLM workflows, provider-agnostic LLM adapter, HMAC-verified webhooks
- **QA:** Unit + integration + workflow tests, seeded demo data for consistent demo experience
```

- [ ] **Step 2: Create `voice-ai-copilot/CHANGELOG.md`**

```markdown
# Changelog

All notable changes are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]

### Added
- Full Voice AI Observability Copilot — initial implementation
- GHL webhook handler with HMAC-SHA256 signature verification and call idempotency
- Provider-agnostic LLM adapter supporting OpenAI (gpt-4o) and Anthropic (claude-3-5-haiku)
- Temporal workflow for durable, retry-safe LLM analysis pipeline
- SSE endpoint for live dashboard updates on workflow completion
- Dashboard view: aggregate metrics, agent health grid, breathing signal waveform indicator
- AgentDetail view: KPI scorecard, recommendation panel, annotated transcript viewer
- KPI configuration editor — users set goal names, weights, and pass threshold per agent
- Seed data — 3 agents with 60 transcripts, analyses, and use actions for demo
- GHL custom JS widget (inject.js) for embedding the copilot in GHL accounts
- README with architecture, real vs mocked table, and Approach 3 upgrade path
```

- [ ] **Step 3: Commit**

```bash
cd C:/Development/Redacted/HighLevel
git add voice-ai-copilot/README.md voice-ai-copilot/CHANGELOG.md
git commit -m "docs: README with architecture, setup, and real vs mocked table + CHANGELOG"
git push
```

---

## Plan 3 Complete

**Final verification — run everything:**

```bash
cd voice-ai-copilot
make infra
make migrate
make seed
make test         # all backend + frontend tests
make dev          # backend :3000, frontend :5173, Temporal UI :8080
```

Open:
- Dashboard: `http://localhost:5173?locationId=demo-location-001`
- Temporal UI: `http://localhost:8080`

**What you have:**
- Complete Vue 3 frontend with Dashboard + AgentDetail views
- All 8 components: MetricCard, LiveIndicator, AgentCard, KpiScoreBar, UseActionBadge, TranscriptViewer, RecommendationPanel, KpiConfigEditor
- SSE-driven live updates — dashboard refreshes when a call is analysed
- Dark Signal design system — IBM Plex Mono + Syne + DM Sans, amber accent, breathing waveform
- GHL custom JS widget + iframe host
- 60 seeded transcripts with analyses for a rich demo
- README + CHANGELOG

**The repository is ready to demo.**
