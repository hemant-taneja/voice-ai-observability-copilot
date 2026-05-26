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
.live-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: background var(--t-base), box-shadow var(--t-base);
}

.live .dot {
  background: var(--pass);
  box-shadow: 0 0 0 0 var(--pass-glow);
  animation: pulse-ring 2s ease-in-out infinite;
}

.label {
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  transition: color var(--t-base);
}

.live .label { color: var(--pass); }
</style>
