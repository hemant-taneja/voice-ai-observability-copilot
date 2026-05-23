<template>
  <div class="live-indicator" :class="connected ? 'live' : 'offline'">
    <span class="dot" />
    <span class="label mono">{{ connected ? 'LIVE' : 'CONNECTING' }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{ connected: boolean }>()
</script>

<style scoped>
.live-indicator { display: inline-flex; align-items: center; gap: 6px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted); }
.live .dot { background: var(--signal); box-shadow: 0 0 0 0 rgba(245,158,11, 0.4); animation: pulse 2s infinite; }
.label { font-size: 11px; letter-spacing: 0.08em; color: var(--text-secondary); }
.live .label { color: var(--signal); }
@keyframes pulse {
  0%   { box-shadow: 0 0 0 0 rgba(245,158,11, 0.5); }
  70%  { box-shadow: 0 0 0 6px rgba(245,158,11, 0); }
  100% { box-shadow: 0 0 0 0 rgba(245,158,11, 0); }
}
</style>
