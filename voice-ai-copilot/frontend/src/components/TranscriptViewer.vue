<template>
  <div class="transcript-viewer">
    <template v-for="(turn, index) in turns" :key="index">
      <div class="turn">
        <span class="turn-timestamp mono">{{ formatMs(turn.timestamp_ms) }}</span>
        <span class="turn-speaker mono" :class="turn.speaker">{{ turn.speaker.toUpperCase() }}</span>
        <p class="turn-text">{{ turn.text }}</p>
      </div>
      <UseActionBadge
        v-for="ua in useActionsAt(index)"
        :key="ua.id"
        :type="ua.type"
        :description="ua.description"
        class="use-action-badge"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import UseActionBadge from './UseActionBadge.vue'
import type { TranscriptTurn, UseAction } from '../types/analysis.types'

const props = defineProps<{
  turns: TranscriptTurn[]
  useActions: UseAction[]
}>()

function useActionsAt(index: number): UseAction[] {
  return props.useActions.filter((ua) => ua.transcriptTurnIndex === index)
}

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60).toString().padStart(2, '0')
  const s = (total % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}
</script>

<style scoped>
.transcript-viewer { display: flex; flex-direction: column; gap: 0; }
.turn {
  display: grid;
  grid-template-columns: 36px 56px 1fr;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border);
  align-items: start;
}
.turn-timestamp { font-size: 10px; color: var(--text-muted); padding-top: 2px; }
.turn-speaker { font-size: 11px; letter-spacing: 0.05em; color: var(--text-muted); padding-top: 2px; }
.turn-speaker.agent { color: var(--signal); }
.turn-speaker.user  { color: var(--info); }
.turn-text { font-size: 13px; color: var(--text-primary); line-height: 1.5; }
</style>
