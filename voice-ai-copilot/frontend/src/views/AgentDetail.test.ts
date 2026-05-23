import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import AgentDetail from './AgentDetail.vue'

vi.mock('../api/agents', () => ({
  agentsApi: {
    getById: vi.fn().mockResolvedValue({
      id: 'ag-1',
      ghlAgentId: 'ghl-ag-1',
      name: 'Test Agent',
      recentAnalyses: [],
    }),
  },
}))

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/agents/:id', component: AgentDetail }],
})

describe('AgentDetail', () => {
  it('renders agent name after loading', async () => {
    router.push('/agents/ag-1?locationId=loc-1')
    await router.isReady()
    const wrapper = mount(AgentDetail, { global: { plugins: [router] } })
    // wait for async ops
    await new Promise((r) => setTimeout(r, 50))
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Test Agent')
  })
})
