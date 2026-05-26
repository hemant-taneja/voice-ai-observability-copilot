import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia } from 'pinia'
import App from './App.vue'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: { template: '<div id="app-root" />' } }],
})

describe('App', () => {
  it('renders without crashing', async () => {
    const pinia = createPinia()
    const wrapper = mount(App, { global: { plugins: [router, pinia] } })
    await router.isReady()
    expect(wrapper.exists()).toBe(true)
  })
})
