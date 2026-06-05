# Analysis Version Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users view any analysis version of a transcript via a dropdown in the detail drawer, with a table badge signalling transcripts that have multiple versions.

**Architecture:** Frontend-only. The backend already returns every analysis per transcript, newest-first, in `TranscriptCard.analyses[]`. We add ephemeral selection state (`selectedVersionIndex`) and a derived `selectedAnalysis` in `AgentDetail.vue`, drive the drawer body off it, and extract two pure helpers (version label + SSE index re-location) into a co-located module so the off-by-one logic is unit-tested in isolation.

**Tech Stack:** Vue 3 (`<script setup>`, Composition API), TypeScript, Vitest + @vue/test-utils.

**Spec:** `docs/superpowers/specs/2026-06-04-analysis-version-selector-design.md`

---

## File Structure

- **Create** `frontend/src/views/agent-detail-versions.ts` — pure helpers: `versionLabel`, `selectedIndexAfterRefresh`. No Vue imports; trivially testable.
- **Create** `frontend/src/views/agent-detail-versions.test.ts` — unit tests for the helpers.
- **Modify** `frontend/src/views/AgentDetail.vue` — selection state, `selectedAnalysis` computed, drawer dropdown, drawer body bindings, table badge, `openDrawer` reset, SSE watcher.
- **Modify** `frontend/src/views/AgentDetail.test.ts` — component tests for switching + badge.

All run commands assume repo root `voice-ai-copilot/` and use `--prefix frontend`.

---

## Task 1: Pure version helpers

**Files:**
- Create: `frontend/src/views/agent-detail-versions.ts`
- Test: `frontend/src/views/agent-detail-versions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/views/agent-detail-versions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { versionLabel, selectedIndexAfterRefresh } from './agent-detail-versions'
import type { AnalysisVersion } from '../types/analysis.types'

function av(id: string): AnalysisVersion {
  return {
    id,
    overallScore: 1,
    passed: true,
    kpiScores: [],
    summary: '',
    analyzedAt: '2026-06-04T00:00:00Z',
    scriptSuggestions: [],
    useActions: [],
  }
}

describe('versionLabel', () => {
  it('labels the newest (index 0) as the highest number with "(latest)"', () => {
    expect(versionLabel(0, 3)).toBe('v3 (latest)')
  })

  it('labels middle and oldest versions descending without "(latest)"', () => {
    expect(versionLabel(1, 3)).toBe('v2')
    expect(versionLabel(2, 3)).toBe('v1')
  })

  it('labels a single analysis as v1 (latest)', () => {
    expect(versionLabel(0, 1)).toBe('v1 (latest)')
  })
})

describe('selectedIndexAfterRefresh', () => {
  const fresh = [av('a4'), av('a3'), av('a2'), av('a1')] // a4 newest after a re-analysis

  it('follows latest when the user was on the latest version', () => {
    expect(selectedIndexAfterRefresh(0, 'a3', fresh)).toBe(0)
  })

  it('follows latest when there was no prior selection', () => {
    expect(selectedIndexAfterRefresh(0, null, fresh)).toBe(0)
  })

  it('stays on the same analysis (by id) when the user was on an older version', () => {
    // user was reading a2 at old index 2; a4 prepended -> a2 is now index 2 here
    expect(selectedIndexAfterRefresh(2, 'a2', fresh)).toBe(2)
  })

  it('relocates the same id even when its index shifts', () => {
    // user on old index 1 reading a3; a3 is now at index 1 -> 1
    expect(selectedIndexAfterRefresh(1, 'a3', fresh)).toBe(1)
  })

  it('falls back to latest when the previously selected id is gone', () => {
    expect(selectedIndexAfterRefresh(2, 'deleted', fresh)).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix frontend -- src/views/agent-detail-versions.test.ts`
Expected: FAIL — `Failed to resolve import "./agent-detail-versions"` (module does not exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `frontend/src/views/agent-detail-versions.ts`:

```ts
import type { AnalysisVersion } from '../types/analysis.types'

// `analyses` is sorted newest-first, so array index and human version number run
// in opposite directions: index 0 is the newest and gets the highest number.
export function versionLabel(index: number, total: number): string {
  const n = total - index
  return index === 0 ? `v${n} (latest)` : `v${n}`
}

// After an SSE-triggered refetch, decide which version index to show.
// - prevIndex 0 (or no prior selection): follow latest (a newly completed
//   re-analysis prepends at index 0, so 0 still points at "latest").
// - otherwise: keep showing the SAME analysis the user navigated to, relocated
//   by its stable id (its index may have shifted as versions prepended).
export function selectedIndexAfterRefresh(
  prevIndex: number,
  prevId: string | null,
  freshAnalyses: AnalysisVersion[],
): number {
  if (prevIndex === 0 || !prevId) return 0
  const i = freshAnalyses.findIndex((a) => a.id === prevId)
  return i >= 0 ? i : 0
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test --prefix frontend -- src/views/agent-detail-versions.test.ts`
Expected: PASS — 8 tests passing.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/agent-detail-versions.ts frontend/src/views/agent-detail-versions.test.ts
git commit -m "feat(frontend): add pure helpers for analysis version labels and SSE index"
```

---

## Task 2: Drawer version dropdown + per-version rendering

**Files:**
- Modify: `frontend/src/views/AgentDetail.vue`
- Test: `frontend/src/views/AgentDetail.test.ts`

- [ ] **Step 1: Write the failing component test**

Replace the entire contents of `frontend/src/views/AgentDetail.test.ts` with:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'
import AgentDetail from './AgentDetail.vue'
import type { TranscriptCard } from '../types/analysis.types'

const MULTI: TranscriptCard[] = [
  {
    transcriptId: 't1',
    ghlCallId: 'seed-001',
    transcriptStatus: 'analyzed',
    durationSeconds: 210,
    ingestedAt: '2026-06-04T16:08:57.837Z',
    turns: [{ speaker: 'agent', text: 'Hi', timestamp_ms: 0 }],
    analyses: [
      { id: 'a3', overallScore: 1, passed: true, kpiScores: [], summary: 'SUMMARY V3', analyzedAt: '2026-06-04T17:57:36Z', scriptSuggestions: [], useActions: [] },
      { id: 'a2', overallScore: 1, passed: true, kpiScores: [], summary: 'SUMMARY V2', analyzedAt: '2026-06-04T17:56:28Z', scriptSuggestions: [], useActions: [] },
      { id: 'a1', overallScore: 0.93, passed: true, kpiScores: [], summary: 'SUMMARY V1', analyzedAt: '2026-06-04T16:08:57Z', scriptSuggestions: [], useActions: [] },
    ],
  },
]

vi.mock('../api/agents', () => ({
  agentsApi: {
    getById: vi.fn().mockResolvedValue({ id: 'ag-1', ghlAgentId: 'ghl-ag-1', name: 'Test Agent', recentAnalyses: [] }),
  },
}))
vi.mock('../api/analysis', () => ({
  analysisApi: { getByAgent: vi.fn().mockResolvedValue(MULTI), reanalyze: vi.fn() },
}))
vi.mock('../api/kpi', () => ({
  kpiApi: { get: vi.fn().mockResolvedValue({ id: 'k1', agentId: 'ag-1', goals: [], successThreshold: 0.7, updatedAt: '' }) },
}))

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/agents/:id', name: 'AgentDetail', component: AgentDetail }],
})

const STUBS = {
  TranscriptViewer: true,
  KpiConfigEditor: true,
  RecommendationPanel: true,
  ScriptDiffPanel: true,
  ScriptSuggestionsPanel: true,
  UseActionBadge: true,
  KpiScoreBar: true,
}

async function mountDetail() {
  const pinia = createPinia()
  router.push('/agents/ag-1?locationId=loc-1')
  await router.isReady()
  const wrapper = mount(AgentDetail, {
    props: { locationId: 'loc-1' },
    global: { plugins: [router, pinia], stubs: STUBS },
  })
  await new Promise((r) => setTimeout(r, 50))
  await wrapper.vm.$nextTick()
  return wrapper
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AgentDetail version selector', () => {
  it('opens the drawer with a version dropdown listing every analysis, newest first', async () => {
    const wrapper = await mountDetail()
    await wrapper.find('.transcript-row').trigger('click')
    await wrapper.vm.$nextTick()

    const select = document.querySelector('[data-testid="version-select"]') as HTMLSelectElement
    expect(select).not.toBeNull()
    const labels = Array.from(select.options).map((o) => o.textContent?.trim())
    expect(labels).toEqual(['v3 (latest)', 'v2', 'v1'])
  })

  it('defaults to the latest version and switches the drawer body when another version is chosen', async () => {
    const wrapper = await mountDetail()
    await wrapper.find('.transcript-row').trigger('click')
    await wrapper.vm.$nextTick()

    expect(document.body.textContent).toContain('SUMMARY V3')
    expect(document.body.textContent).not.toContain('SUMMARY V1')

    const select = document.querySelector('[data-testid="version-select"]') as HTMLSelectElement
    select.value = '2' // index 2 -> v1
    select.dispatchEvent(new Event('change'))
    await wrapper.vm.$nextTick()

    expect(document.body.textContent).toContain('SUMMARY V1')
    expect(document.body.textContent).not.toContain('SUMMARY V3')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix frontend -- src/views/AgentDetail.test.ts`
Expected: FAIL — `select` is `null` (no `[data-testid="version-select"]` exists yet).

- [ ] **Step 3: Import helpers and add selection state**

In `frontend/src/views/AgentDetail.vue`, add to the imports near the other local imports (after the `import ScriptDiffPanel ...` line):

```ts
import { versionLabel, selectedIndexAfterRefresh } from './agent-detail-versions'
```

Immediately after the drawer state declarations:

```ts
const drawerOpen = ref(false)
const drawerCard = ref<TranscriptCard | null>(null)
```

add:

```ts
// Which analysis version is shown in the drawer (index into drawerCard.analyses,
// 0 = latest). Reset to latest whenever a transcript's drawer opens.
const selectedVersionIndex = ref(0)
const selectedAnalysis = computed<AnalysisVersion | null>(
  () => drawerCard.value?.analyses[selectedVersionIndex.value] ?? null,
)
```

(`computed` and `AnalysisVersion` are already imported.)

- [ ] **Step 4: Reset selection in `openDrawer`**

Replace the existing `openDrawer` function:

```ts
function openDrawer(tc: TranscriptCard) {
  drawerCard.value = tc
  drawerOpen.value = true
}
```

with:

```ts
function openDrawer(tc: TranscriptCard) {
  drawerCard.value = tc
  selectedVersionIndex.value = 0
  drawerOpen.value = true
}
```

- [ ] **Step 5: Point the drawer body at the selected version**

In `AgentDetail.vue`, replace every occurrence of the exact substring `latestAnalysis(drawerCard)` with `selectedAnalysis`. (These appear only inside the drawer `<Teleport>` block; the table uses `latestAnalysis(tc)` and must stay unchanged.)

Verify after editing:

Run: `grep -n "latestAnalysis(drawerCard)" frontend/src/views/AgentDetail.vue`
Expected: no matches.

Run: `grep -n "latestAnalysis(tc)" frontend/src/views/AgentDetail.vue`
Expected: still present (table rows unchanged).

- [ ] **Step 6: Add the dropdown to the drawer header**

In the drawer header, replace this block:

```html
                <div class="drawer-title-row">
                  <span class="drawer-title">Call Analysis</span>
                  <span v-if="drawerCard && latestAnalysis(drawerCard)" class="result-chip" :class="latestAnalysis(drawerCard)!.passed ? 'pass' : 'fail'">
                    {{ latestAnalysis(drawerCard)!.passed ? 'Pass' : 'Fail' }}
                  </span>
                </div>
```

with (note `latestAnalysis(drawerCard)` already became `selectedAnalysis` in Step 5, so match the post-Step-5 text):

```html
                <div class="drawer-title-row">
                  <span class="drawer-title">Call Analysis</span>
                  <span v-if="drawerCard && selectedAnalysis" class="result-chip" :class="selectedAnalysis!.passed ? 'pass' : 'fail'">
                    {{ selectedAnalysis!.passed ? 'Pass' : 'Fail' }}
                  </span>
                  <select
                    v-if="drawerCard && drawerCard.analyses.length"
                    data-testid="version-select"
                    class="version-select mono"
                    v-model.number="selectedVersionIndex"
                  >
                    <option v-for="(a, i) in drawerCard.analyses" :key="a.id" :value="i">
                      {{ versionLabel(i, drawerCard.analyses.length) }}
                    </option>
                  </select>
                </div>
```

- [ ] **Step 7: Update the SSE watcher to preserve the viewed version**

Replace the drawer-sync tail of the `watch(() => streamStore.lastEvent, ...)` handler:

```ts
  // Sync the open drawer card so analysis renders without closing it
  if (drawerCard.value) {
    const updated = fresh.find((tc) => tc.transcriptId === drawerCard.value!.transcriptId)
    if (updated) drawerCard.value = updated
  }
```

with:

```ts
  // Sync the open drawer card so analysis renders without closing it, keeping the
  // user on the version they were reading (or following latest if they were on it).
  if (drawerCard.value) {
    const prevIndex = selectedVersionIndex.value
    const prevId = selectedAnalysis.value?.id ?? null
    const updated = fresh.find((tc) => tc.transcriptId === drawerCard.value!.transcriptId)
    if (updated) {
      drawerCard.value = updated
      selectedVersionIndex.value = selectedIndexAfterRefresh(prevIndex, prevId, updated.analyses)
    }
  }
```

- [ ] **Step 8: Add minimal styling for the dropdown**

In the `<style scoped>` block, directly after the `.drawer-title { ... }` rule, add:

```css
.version-select {
  margin-left: 8px;
  background: var(--bg-surface);
  color: var(--text-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 3px 8px;
  font-size: 12px;
  cursor: pointer;
}

.version-select:focus { outline: none; border-color: var(--accent); }
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm test --prefix frontend -- src/views/AgentDetail.test.ts`
Expected: PASS — both "version selector" tests pass (dropdown lists `v3 (latest)/v2/v1`; switching to index 2 shows `SUMMARY V1`).

- [ ] **Step 10: Commit**

```bash
git add frontend/src/views/AgentDetail.vue frontend/src/views/AgentDetail.test.ts
git commit -m "feat(frontend): analysis version dropdown in transcript drawer"
```

---

## Task 3: Table version badge

**Files:**
- Modify: `frontend/src/views/AgentDetail.vue`
- Test: `frontend/src/views/AgentDetail.test.ts`

- [ ] **Step 1: Add the failing test**

Append this `it` block inside the existing `describe('AgentDetail version selector', ...)` in `frontend/src/views/AgentDetail.test.ts` (before its closing `})`):

```ts
  it('shows a version badge in the table only when a transcript has multiple analyses', async () => {
    const wrapper = await mountDetail()
    const badge = wrapper.find('[data-testid="version-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('v3')
  })

  it('hides the version badge for a single-analysis transcript', async () => {
    const { analysisApi } = await import('../api/analysis')
    ;(analysisApi.getByAgent as any).mockResolvedValueOnce([
      { ...MULTI[0], analyses: [MULTI[0].analyses[0]] },
    ])
    const wrapper = await mountDetail()
    expect(wrapper.find('[data-testid="version-badge"]').exists()).toBe(false)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --prefix frontend -- src/views/AgentDetail.test.ts`
Expected: FAIL — `[data-testid="version-badge"]` does not exist.

- [ ] **Step 3: Add the badge to the score cell**

In the table body, replace the score cell:

```html
              <td class="col-score">
                <span v-if="latestAnalysis(tc)" class="score-val" :class="latestAnalysis(tc)!.passed ? 'pass' : 'fail'">
                  {{ pct(latestAnalysis(tc)!.overallScore) }}
                </span>
                <span v-else class="score-val pending">—</span>
              </td>
```

with:

```html
              <td class="col-score">
                <span v-if="latestAnalysis(tc)" class="score-val" :class="latestAnalysis(tc)!.passed ? 'pass' : 'fail'">
                  {{ pct(latestAnalysis(tc)!.overallScore) }}
                </span>
                <span v-else class="score-val pending">—</span>
                <span v-if="tc.analyses.length > 1" data-testid="version-badge" class="version-badge mono">v{{ tc.analyses.length }}</span>
              </td>
```

- [ ] **Step 4: Style the badge**

In `<style scoped>`, directly after the `.score-val.pending { ... }` rule, add:

```css
.version-badge {
  display: inline-block;
  margin-left: 6px;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 99px;
  background: var(--bg-hover);
  color: var(--text-muted);
  border: 1px solid var(--border);
  vertical-align: middle;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --prefix frontend -- src/views/AgentDetail.test.ts`
Expected: PASS — all four version-selector tests pass.

- [ ] **Step 6: Run the full frontend suite and type-check**

Run: `npm test --prefix frontend`
Expected: PASS — no regressions across the suite.

Run: `npm run build --prefix frontend`
Expected: `vue-tsc` reports no type errors and the build succeeds.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/views/AgentDetail.vue frontend/src/views/AgentDetail.test.ts
git commit -m "feat(frontend): table badge for transcripts with multiple analyses"
```

---

## Manual verification (after Task 3)

1. Ensure the Vite dev server was started after `frontend/.env.development` exists (so `VITE_API_BASE_URL=http://localhost:3000` is loaded). Restart it if unsure.
2. Open an agent with a re-analyzed transcript (e.g. Aria / `seed-001`, which has 3 analyses).
3. Confirm the table row shows a `v3` badge next to the score.
4. Open the drawer: the header shows a `v3 (latest)` dropdown. Selecting `v1` re-renders the summary/score/KPIs for the oldest run; selecting back to `v3` restores the latest.
5. With the drawer open on `v3`, trigger Re-analyze: when it completes, you follow the new latest. Re-open on `v1`, trigger Re-analyze: you stay on `v1`.

---

## Self-Review

**Spec coverage:**
- Drawer dropdown, version-number labels newest=highest → Task 2 (Step 6) + `versionLabel` (Task 1). ✓
- Default to latest on open → Task 2 (Step 4). ✓
- Drawer body renders the selected version → Task 2 (Step 5). ✓
- Dropdown hidden only when `analyses.length === 0` → Task 2 (Step 6, `v-if="drawerCard.analyses.length"`). ✓
- Table badge only when `analyses.length > 1`, shows `v{length}` → Task 3. ✓
- SSE two-mode preservation → `selectedIndexAfterRefresh` (Task 1) wired in Task 2 (Step 7). ✓
- Tests → Task 1 (helpers), Task 2 + Task 3 (component). ✓

**Placeholder scan:** none — every code/command/expected-output step is concrete.

**Type/name consistency:** `versionLabel(index, total)` and `selectedIndexAfterRefresh(prevIndex, prevId, freshAnalyses)` are defined in Task 1 and used with the same signatures in Task 2. `selectedVersionIndex` / `selectedAnalysis` names are consistent across Steps 3–7. `data-testid` values (`version-select`, `version-badge`) match between tests and markup.
