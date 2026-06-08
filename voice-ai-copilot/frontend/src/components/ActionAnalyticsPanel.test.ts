import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import ActionAnalyticsPanel from './ActionAnalyticsPanel.vue'
import type { ActionAnalytics } from '../types/analysis.types'

const analytics: ActionAnalytics[] = [
  {
    ghlActionId: 'act-book',
    actionType: 'APPOINTMENT_BOOKING',
    name: 'Book Appointment',
    triggerPrompt: 'When the patient picks a slot',
    fireCount: 3,
    missedCount: 0,
    incorrectCount: 0,
    latestPromptFlaw: null,
    latestSuggestedTriggerPrompt: null,
  },
  {
    ghlActionId: 'act-sms',
    actionType: 'SMS',
    name: 'Send Confirmation SMS',
    triggerPrompt: 'After booking, send a confirmation SMS',
    fireCount: 0,
    missedCount: 2,
    incorrectCount: 0,
    latestPromptFlaw: 'trigger does not mention confirming the callback number',
    latestSuggestedTriggerPrompt: 'After booking, send the SMS and confirm the callback number',
  },
]

describe('ActionAnalyticsPanel', () => {
  it('renders one card per action with fire counts', () => {
    const wrapper = mount(ActionAnalyticsPanel, { props: { analytics } })
    expect(wrapper.findAll('.action-card')).toHaveLength(2)
    expect(wrapper.text()).toContain('3× fired')
    expect(wrapper.text()).toContain('2 missed')
  })

  it('flags the action with a triggerPrompt flaw and shows the suggested rewrite', () => {
    const wrapper = mount(ActionAnalyticsPanel, { props: { analytics } })
    const flagged = wrapper.findAll('.action-card').find((c) => c.classes().includes('has-missed'))
    expect(flagged).toBeTruthy()
    expect(wrapper.text()).toContain('trigger does not mention confirming the callback number')
    expect(wrapper.text()).toContain('After booking, send the SMS and confirm the callback number')
  })

  it('shows an empty state when there are no actions', () => {
    const wrapper = mount(ActionAnalyticsPanel, { props: { analytics: [] } })
    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })
})
