import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'

describe('App', () => {
  it('renders without crashing', () => {
    const wrapper = mount(App)
    expect(wrapper.find('#app-root').exists()).toBe(true)
  })
})
