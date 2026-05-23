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
