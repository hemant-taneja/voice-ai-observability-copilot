import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import TranscriptViewer from './TranscriptViewer.vue'
import type { TranscriptTurn, UseAction, ActionFinding } from '../types/analysis.types'

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
    expect(wrapper.findAll('.inline-action')).toHaveLength(1)
    expect(wrapper.text()).toContain('Did not confirm contact number')
  })

  it('labels agent turns differently from user turns', () => {
    const wrapper = mount(TranscriptViewer, { props: { turns, useActions: [] } })
    const speakers = wrapper.findAll('.turn-speaker')
    expect(speakers[0].classes()).toContain('agent')
    expect(speakers[1].classes()).toContain('user')
  })

  it('renders a tool-call marker for an action finding, colored by status', () => {
    const actionFindings: ActionFinding[] = [
      { id: 'af-1', ghlActionId: 'act-1', actionType: 'SMS', actionName: 'Send Confirmation SMS', transcriptTurnIndex: 2, status: 'missed', description: 'SMS never sent', promptFlaw: null, suggestedTriggerPrompt: null },
    ]
    const wrapper = mount(TranscriptViewer, { props: { turns, useActions: [], actionFindings } })
    const marker = wrapper.find('.inline-action.tool-call')
    expect(marker.exists()).toBe(true)
    expect(marker.classes()).toContain('status-missed')
    expect(marker.text()).toContain('Send Confirmation SMS')
    expect(marker.text()).toContain('MISSED')
  })

  it('places tool-call and use-action markers on their own turns', () => {
    const actionFindings: ActionFinding[] = [
      { id: 'af-1', ghlActionId: null, actionType: 'APPOINTMENT_BOOKING', actionName: 'Book', transcriptTurnIndex: 0, status: 'correct', description: 'Booked', promptFlaw: null, suggestedTriggerPrompt: null },
    ]
    const wrapper = mount(TranscriptViewer, { props: { turns, useActions, actionFindings } })
    // one use-action (turn 2) + one tool-call (turn 0)
    expect(wrapper.findAll('.inline-action')).toHaveLength(2)
    expect(wrapper.findAll('.inline-action.tool-call')).toHaveLength(1)
  })
})
