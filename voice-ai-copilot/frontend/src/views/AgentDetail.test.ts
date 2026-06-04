import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'
import AgentDetail from './AgentDetail.vue'
import type { TranscriptCard } from '../types/analysis.types'

const MULTI = vi.hoisted((): TranscriptCard[] => [
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
])

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
