<template>
  <div class="transcript-viewer">
    <template v-for="(turn, index) in turns" :key="index">
      <div class="turn" :class="turn.speaker">
        <div class="turn-meta">
          <span class="turn-ts mono">{{ formatMs(turn.timestamp_ms) }}</span>
          <span class="turn-speaker" :class="turn.speaker">
            {{ turn.speaker === 'agent' ? 'AGENT' : 'USER' }}
          </span>
        </div>
        <p class="turn-text">{{ turn.text }}</p>
      </div>
      <div
        v-for="ua in useActionsAt(index)"
        :key="ua.id ?? `ua-${index}`"
        class="inline-action"
        :class="ua.type"
      >
        <span class="action-icon">{{ actionIcon(ua.type) }}</span>
        <div class="action-body">
          <span class="action-type">{{ actionLabel(ua.type) }}</span>
          <span class="action-desc">{{ ua.description }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
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

function actionIcon(type: string): string {
  return { missed_opportunity: '◈', deviation: '△', escalation_needed: '⚠' }[type] ?? '●'
}

function actionLabel(type: string): string {
  return {
    missed_opportunity: 'MISSED OPPORTUNITY',
    deviation: 'DEVIATION',
    escalation_needed: 'ESCALATION NEEDED',
  }[type] ?? type.toUpperCase()
}
</script>

<style scoped>
.transcript-viewer {
  display: flex;
  flex-direction: column;
  max-height: 480px;
  overflow-y: auto;
}

/* ── Turn ────────────────────────────────────────────────── */
.turn {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-subtle);
  align-items: start;
  transition: background var(--t-fast);
}

.turn:hover {
  background: var(--bg-hover);
}

.turn.agent {
  background: rgba(79, 136, 255, 0.03);
}

.turn-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-top: 1px;
}

.turn-ts {
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.03em;
}

.turn-speaker {
  font-size: 9.5px;
  font-family: var(--font-mono);
  font-weight: 600;
  letter-spacing: 0.07em;
}

.turn-speaker.agent { color: var(--accent); }
.turn-speaker.user  { color: var(--pass);   }

.turn-text {
  font-size: 13px;
  color: var(--text);
  line-height: 1.6;
}

/* ── Inline action ───────────────────────────────────────── */
.inline-action {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-subtle);
  border-left: 3px solid var(--warn);
  background: rgba(255, 171, 46, 0.04);
}

.inline-action.deviation {
  border-left-color: var(--accent);
  background: rgba(79, 136, 255, 0.04);
}

.inline-action.escalation_needed {
  border-left-color: var(--fail);
  background: rgba(255, 65, 105, 0.04);
}

.action-icon {
  font-size: 13px;
  margin-top: 1px;
  flex-shrink: 0;
  color: var(--warn);
}

.inline-action.deviation .action-icon       { color: var(--accent); }
.inline-action.escalation_needed .action-icon { color: var(--fail); }

.action-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.action-type {
  font-size: 9.5px;
  font-family: var(--font-mono);
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--warn);
}

.inline-action.deviation .action-type       { color: var(--accent); }
.inline-action.escalation_needed .action-type { color: var(--fail); }

.action-desc {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.4;
}
</style>
