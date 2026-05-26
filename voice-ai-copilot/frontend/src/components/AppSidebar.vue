<template>
  <aside class="sidebar">
    <!-- Brand -->
    <div class="sidebar-brand">
      <div class="brand-icon">
        <svg width="20" height="14" viewBox="0 0 24 16" fill="none">
          <path d="M0 8 Q3 1 6 8 Q9 15 12 8 Q15 1 18 8 Q21 15 24 8"
            stroke="var(--accent)" stroke-width="2" stroke-linecap="round" fill="none"/>
        </svg>
      </div>
      <div class="brand-text">
        <span class="brand-name">Voice AI</span>
        <span class="brand-sub">Copilot</span>
      </div>
      <div class="live-pill" :class="streamStore.connected ? 'live' : 'off'">
        <span class="live-dot" />
        <span>{{ streamStore.connected ? 'LIVE' : 'OFF' }}</span>
      </div>
    </div>

    <!-- Primary nav -->
    <nav class="sidebar-nav">
      <RouterLink
        :to="{ path: '/', query: { locationId } }"
        class="nav-item"
        :class="{ active: route.name === 'Dashboard' }"
      >
        <svg class="nav-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
          <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
          <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
          <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        <span>Overview</span>
      </RouterLink>

      <RouterLink
        :to="{ path: '/playground', query: { locationId } }"
        class="nav-item"
        :class="{ active: route.name === 'Playground' }"
      >
        <svg class="nav-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M5 2h2v5l3 3-1 1-3-3H3l-1-1 3-3V2z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="none"/>
          <circle cx="11.5" cy="11.5" r="3" stroke="currentColor" stroke-width="1.4" fill="none"/>
          <path d="M10.5 11.5h2M11.5 10.5v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
        <span>Playground</span>
      </RouterLink>
    </nav>

    <!-- Divider -->
    <div class="sidebar-divider" />

    <!-- Agent list -->
    <div class="sidebar-section">
      <div class="section-label">AGENTS</div>

      <div v-if="agentsStore.loading" class="agent-skeleton">
        <div class="skeleton-item" v-for="i in 3" :key="i" />
      </div>

      <div v-else class="agent-list">
        <RouterLink
          v-for="agent in agentsStore.agents"
          :key="agent.id"
          :to="{ name: 'AgentDetail', params: { id: agent.id }, query: { locationId } }"
          class="sidebar-agent"
          :class="{
            active: route.params.id === agent.id,
            passing: getHealth(agent) === 'pass',
            failing: getHealth(agent) === 'fail',
          }"
        >
          <span class="agent-health-dot" :class="getHealth(agent)" />
          <span class="agent-label">{{ agent.name }}</span>
          <span v-if="reviewStore.openActionsFor(agent.id, agent.openUseActions) > 0" class="agent-alert-badge">
            {{ reviewStore.openActionsFor(agent.id, agent.openUseActions) }}
          </span>
        </RouterLink>
      </div>
    </div>

    <!-- Footer -->
    <div class="sidebar-footer">
      <div class="footer-row">
        <div class="location-chip">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="4" stroke="currentColor" stroke-width="1.2"/>
            <circle cx="5" cy="5" r="1.5" fill="currentColor"/>
          </svg>
          <span class="mono">{{ locationId }}</span>
        </div>
        <button class="theme-toggle" @click="$emit('toggle-theme')" :title="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'">
          <!-- Sun icon (shown in dark mode to switch to light) -->
          <svg v-if="theme === 'dark'" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="2.5" stroke="currentColor" stroke-width="1.3"/>
            <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.9 2.9l1.1 1.1M10 10l1.1 1.1M2.9 11.1 4 10M10 4l1.1-1.1"
              stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
          <!-- Moon icon (shown in light mode to switch to dark) -->
          <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M11.5 8.5A5 5 0 015.5 2.5a5 5 0 100 9 5 5 0 006-3z"
              stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { useAgentsStore } from '../stores/agents'
import { useStreamStore } from '../stores/stream'
import { useReviewStore } from '../stores/review'
import type { Agent } from '../types/agent.types'
import { onMounted } from 'vue'

const props = defineProps<{ locationId: string; theme: 'dark' | 'light' }>()
defineEmits<{ 'toggle-theme': [] }>()

const route = useRoute()
const agentsStore = useAgentsStore()
const streamStore = useStreamStore()
const reviewStore = useReviewStore()

onMounted(() => {
  if (!agentsStore.agents.length) {
    agentsStore.fetchAll(props.locationId)
  }
})

function getHealth(agent: Agent): 'pass' | 'fail' | 'unknown' {
  if (agent.passRate === null) return 'unknown'
  return agent.passRate >= 0.7 ? 'pass' : 'fail'
}
</script>

<style scoped>
/* ── Shell ───────────────────────────────────────────────── */
.sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  height: 100vh;
  position: sticky;
  top: 0;
  background: var(--bg-surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: background var(--t-slow), border-color var(--t-slow);
}

/* ── Brand ───────────────────────────────────────────────── */
.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 16px 16px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.brand-icon {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-dim);
  border: 1px solid rgba(79, 136, 255, 0.25);
  border-radius: 9px;
  flex-shrink: 0;
}

.brand-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  line-height: 1.1;
  min-width: 0;
}

.brand-name {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
}

.brand-sub {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
  letter-spacing: 0.01em;
}

/* ── Live Pill ───────────────────────────────────────────── */
.live-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 7px;
  border-radius: 99px;
  font-size: 8.5px;
  font-family: var(--font-mono);
  font-weight: 600;
  letter-spacing: 0.07em;
  flex-shrink: 0;
  transition: all var(--t-base);
}

.live-pill.live {
  background: var(--pass-dim);
  color: var(--pass);
  border: 1px solid rgba(0, 201, 141, 0.3);
}

.live-pill.off {
  background: var(--bg-hover);
  color: var(--text-muted);
  border: 1px solid var(--border);
}

.live-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.live-pill.live .live-dot {
  animation: pulse-ring 2s ease-in-out infinite;
}

/* ── Nav ─────────────────────────────────────────────────── */
.sidebar-nav {
  padding: 10px 10px 6px;
  flex-shrink: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  border-radius: 7px;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-2);
  text-decoration: none;
  transition: all var(--t-fast);
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text);
  text-decoration: none;
}

.nav-item.active {
  background: var(--accent-dim);
  color: var(--accent);
}

.nav-icon { flex-shrink: 0; }

/* ── Divider ─────────────────────────────────────────────── */
.sidebar-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 4px 0;
  flex-shrink: 0;
}

/* ── Section ─────────────────────────────────────────────── */
.sidebar-section {
  flex: 1;
  overflow-y: auto;
  padding: 6px 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.section-label {
  font-size: 9.5px;
  font-family: var(--font-mono);
  letter-spacing: 0.1em;
  color: var(--text-muted);
  padding: 8px 6px 6px;
  font-weight: 600;
}

/* ── Agent List ──────────────────────────────────────────── */
.agent-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.sidebar-agent {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  text-decoration: none;
  transition: all var(--t-fast);
}

.sidebar-agent:hover {
  background: var(--bg-hover);
  color: var(--text);
  text-decoration: none;
}

.sidebar-agent.active {
  background: var(--bg-selected);
  color: var(--text);
}

.agent-health-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--border);
  transition: all var(--t-base);
}

.agent-health-dot.pass {
  background: var(--pass);
  box-shadow: 0 0 6px var(--pass-glow);
}

.agent-health-dot.fail {
  background: var(--fail);
  box-shadow: 0 0 6px var(--fail-glow);
  animation: pulse-fail 2.5s ease-in-out infinite;
}

.agent-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-alert-badge {
  font-size: 9.5px;
  font-family: var(--font-mono);
  font-weight: 700;
  background: var(--warn-dim);
  color: var(--warn);
  border: 1px solid rgba(245, 158, 11, 0.3);
  padding: 1px 6px;
  border-radius: 99px;
  flex-shrink: 0;
}

/* ── Skeletons ───────────────────────────────────────────── */
.agent-skeleton {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.skeleton-item {
  height: 34px;
  border-radius: 7px;
  background: linear-gradient(90deg, var(--bg-card) 25%, var(--bg-hover) 50%, var(--bg-card) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
}

/* ── Footer ──────────────────────────────────────────────── */
.sidebar-footer {
  padding: 12px 14px;
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.location-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: var(--text-muted);
  min-width: 0;
}

.location-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theme-toggle {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--bg-hover);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--t-fast);
  flex-shrink: 0;
}

.theme-toggle:hover {
  background: var(--bg-selected);
  color: var(--text);
  border-color: var(--text-muted);
}
</style>
