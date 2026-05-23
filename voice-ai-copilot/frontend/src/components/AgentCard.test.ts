import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import AgentCard from './AgentCard.vue'
import type { Agent } from '../types/agent.types'

const router = createRouter({ history: createWebHistory(), routes: [{ path: '/', component: { template: '<div/>' } }] })

const passingAgent: Agent = { id: 'ag-1', ghlAgentId: 'g-1', name: 'Agent Alpha', script: null, passRate: 0.82, totalCalls: 12, openUseActions: 2 }
const failingAgent: Agent = { id: 'ag-2', ghlAgentId: 'g-2', name: 'Agent Beta', script: null, passRate: 0.41, totalCalls: 9, openUseActions: 7 }

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
