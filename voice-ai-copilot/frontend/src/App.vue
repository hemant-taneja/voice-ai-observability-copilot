<template>
  <div class="app-shell" :data-theme="theme">
    <AppSidebar :locationId="locationId" :theme="theme" @toggle-theme="toggleTheme" />
    <main class="app-main">
      <RouterView :locationId="locationId" :key="$route.path" />
    </main>
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterView } from 'vue-router'
import AppSidebar from './components/AppSidebar.vue'
import ToastContainer from './components/ToastContainer.vue'
import { useStreamStore } from './stores/stream'
import { useAgentsStore } from './stores/agents'
import { useAnalysisStore } from './stores/analysis'
import { useReviewStore } from './stores/review'
import { useSSE } from './composables/useSSE'
import { useToast } from './composables/useToast'

const locationId = new URLSearchParams(window.location.search).get('locationId') ?? 'demo-location-001'

const streamStore  = useStreamStore()
const agentsStore  = useAgentsStore()
const analysisStore = useAnalysisStore()
const reviewStore  = useReviewStore()
const { add: addToast } = useToast()

// Hydrate reviewed state from localStorage once on app start
reviewStore.hydrate()

const { connected } = useSSE(locationId, async (event) => {
  streamStore.setConnected(true)
  streamStore.setLastEvent(event)

  if (event.type === 'analysis.complete' && event.agentId) {
    await agentsStore.fetchAll(locationId)
    const agent = agentsStore.agents.find(a => a.ghlAgentId === event.agentId)
    if (agent) analysisStore.fetchResults(agent.id, locationId)
    addToast('Analysis complete', 'success')
  }

  if (event.type === 'analysis.failed' && event.agentId) {
    const agent = agentsStore.agents.find(a => a.ghlAgentId === event.agentId)
    if (agent) analysisStore.fetchResults(agent.id, locationId)
    addToast('Analysis failed — transcript marked for retry', 'error')
  }
})
streamStore.setConnected(connected.value)

// Theme management
const savedTheme  = localStorage.getItem('theme') as 'dark' | 'light' | null
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
const theme = ref<'dark' | 'light'>(savedTheme ?? (prefersDark ? 'dark' : 'light'))

watch(theme, (val) => {
  localStorage.setItem('theme', val)
  document.documentElement.setAttribute('data-theme', val)
}, { immediate: true })

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
}
</script>

<style>
.app-shell {
  display: flex;
  min-height: 100vh;
}

.app-main {
  flex: 1;
  min-width: 0;
  overflow-x: hidden;
  background: var(--bg);
  transition: background var(--t-slow);
}
</style>
