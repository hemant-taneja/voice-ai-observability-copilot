<template>
  <div class="playground">
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">Playground</h1>
        <p class="page-sub">Build a test transcript and run it through an agent's KPI analysis</p>
      </div>
    </header>

    <div class="playground-layout">
      <!-- Left: builder -->
      <section class="builder-panel">

        <!-- Agent select -->
        <div class="panel-block">
          <label class="field-label">Agent</label>
          <select v-model="selectedAgentId" class="agent-select" :disabled="submitting">
            <option value="">— select an agent —</option>
            <option v-for="a in agentsStore.agents" :key="a.id" :value="a.id">
              {{ a.name }}
            </option>
          </select>
        </div>

        <!-- Turn builder -->
        <div class="panel-block turns-block">
          <div class="turns-header">
            <label class="field-label">Conversation Turns</label>
            <div class="turn-add-btns">
              <button class="add-turn-btn agent-btn" @click="addTurn('agent')" :disabled="submitting">+ Agent</button>
              <button class="add-turn-btn user-btn" @click="addTurn('user')" :disabled="submitting">+ User</button>
            </div>
          </div>

          <div v-if="turns.length === 0" class="turns-empty">
            Add turns to build the conversation
          </div>

          <div v-else class="turns-list">
            <div
              v-for="(turn, i) in turns"
              :key="i"
              class="turn-row"
              :class="turn.speaker"
            >
              <div class="turn-speaker-badge" :class="turn.speaker">
                {{ turn.speaker === 'agent' ? 'Agent' : 'User' }}
              </div>
              <textarea
                v-model="turn.text"
                class="turn-input"
                :placeholder="turn.speaker === 'agent' ? 'What the agent said…' : 'What the user said…'"
                rows="2"
                :disabled="submitting"
              />
              <button class="turn-delete" @click="removeTurn(i)" :disabled="submitting" title="Remove">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Submit -->
        <div class="panel-block submit-block">
          <button
            class="run-btn"
            :disabled="!canSubmit"
            @click="runAnalysis"
          >
            <svg v-if="submitting" width="14" height="14" viewBox="0 0 14 14" fill="none" class="spin">
              <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.8" stroke-dasharray="16" stroke-dashoffset="5"/>
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 2l9 5-9 5V2z" fill="currentColor"/>
            </svg>
            {{ submitting ? 'Analysing…' : 'Run Analysis' }}
          </button>
          <p v-if="submitError" class="submit-error">{{ submitError }}</p>
        </div>
      </section>

      <!-- Right: result -->
      <section class="result-panel">
        <div class="result-header">
          <span class="field-label">Result</span>
          <span v-if="resultState === 'waiting'" class="result-status waiting">
            <span class="pulse-dot" /> Analysing…
          </span>
          <span v-else-if="resultState === 'done'" class="result-status done">Complete</span>
          <span v-else-if="resultState === 'failed'" class="result-status failed">Failed</span>
        </div>

        <div v-if="!lastTranscriptId" class="result-empty">
          Run an analysis to see results here
        </div>

        <div v-else-if="resultState === 'waiting'" class="result-waiting">
          <div class="spinner-lg" />
          <p>LLM is evaluating the transcript…</p>
        </div>

        <div v-else-if="resultState === 'failed'" class="result-failed">
          Analysis failed. Check that this agent has a KPI config set.
        </div>

        <template v-else-if="resultState === 'done' && resultCard">
          <div class="result-score-row">
            <div class="big-score" :class="resultCard.analyses[0]?.passed ? 'pass' : 'fail'">
              {{ pct(resultCard.analyses[0]?.overallScore) }}
            </div>
            <div class="result-verdict" :class="resultCard.analyses[0]?.passed ? 'pass' : 'fail'">
              {{ resultCard.analyses[0]?.passed ? 'PASS' : 'FAIL' }}
            </div>
          </div>

          <p class="result-summary">{{ resultCard.analyses[0]?.summary }}</p>

          <div class="kpi-scores">
            <div
              v-for="ks in resultCard.analyses[0]?.kpiScores ?? []"
              :key="ks.goal"
              class="kpi-row"
            >
              <div class="kpi-label-row">
                <span class="kpi-goal">{{ ks.goal }}</span>
                <span class="kpi-score-val" :class="ks.passed ? 'pass' : 'fail'">{{ pct(ks.score) }}</span>
              </div>
              <div class="kpi-bar-track">
                <div class="kpi-bar-fill" :class="ks.passed ? 'pass' : 'fail'" :style="{ width: pct(ks.score) }" />
              </div>
            </div>
          </div>

          <div v-if="resultCard.analyses[0]?.useActions?.length" class="use-actions-section">
            <div class="field-label" style="margin-bottom: 8px">Use Actions</div>
            <div
              v-for="ua in resultCard.analyses[0]?.useActions"
              :key="ua.id"
              class="ua-pill"
              :class="ua.type"
            >
              <span class="ua-type">{{ ua.type.replace(/_/g, ' ') }}</span>
              <span class="ua-desc">{{ ua.description }}</span>
            </div>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useAgentsStore } from '../stores/agents'
import { useStreamStore } from '../stores/stream'
import { agentsApi, SimulateTurn } from '../api/agents'
import { analysisApi } from '../api/analysis'
import type { TranscriptCard } from '../types/analysis.types'

const props = defineProps<{ locationId: string }>()

const agentsStore = useAgentsStore()
const streamStore = useStreamStore()

const selectedAgentId = ref('')
const turns = ref<SimulateTurn[]>([])
const submitting = ref(false)
const submitError = ref<string | null>(null)
const lastTranscriptId = ref<string | null>(null)
const resultState = ref<'idle' | 'waiting' | 'done' | 'failed'>('idle')
const resultCard = ref<TranscriptCard | null>(null)

onMounted(() => {
  if (!agentsStore.agents.length) agentsStore.fetchAll(props.locationId)
})

let tsMs = 0
function addTurn(speaker: 'agent' | 'user') {
  turns.value.push({ speaker, text: '', timestamp_ms: tsMs })
  tsMs += 3000
}

function removeTurn(i: number) {
  turns.value.splice(i, 1)
}

const canSubmit = computed(() =>
  !!selectedAgentId.value &&
  turns.value.length > 0 &&
  turns.value.every(t => t.text.trim()) &&
  !submitting.value
)

async function runAnalysis() {
  if (!canSubmit.value) return
  submitError.value = null
  resultState.value = 'idle'
  resultCard.value = null
  lastTranscriptId.value = null
  submitting.value = true

  try {
    const result = await agentsApi.simulate(selectedAgentId.value, props.locationId, turns.value)
    lastTranscriptId.value = result.transcriptId
    resultState.value = 'waiting'
  } catch (err: any) {
    submitError.value = err?.response?.data?.error ?? 'Failed to submit'
  } finally {
    submitting.value = false
  }
}

// Watch SSE events for analysis completion
watch(() => streamStore.lastEvent, async (event) => {
  if (resultState.value !== 'waiting' || !lastTranscriptId.value) return
  if (event?.type === 'analysis.complete') {
    // Fetch the specific transcript card
    const cards = await analysisApi.getByAgent(selectedAgentId.value, props.locationId)
    const card = cards.find(c => c.transcriptId === lastTranscriptId.value)
    if (card) {
      resultCard.value = card
      resultState.value = 'done'
    }
  }
  if (event?.type === 'analysis.failed') {
    resultState.value = 'failed'
  }
})

function pct(val: number | null | undefined): string {
  if (val == null) return '—'
  return `${Math.round(val * 100)}%`
}
</script>

<style scoped>
.playground {
  padding: 28px 32px;
  max-width: 1100px;
}

/* ── Header ──────────────────────────────────────────────── */
.page-header { margin-bottom: 24px; }
.page-title  { font-size: 20px; font-weight: 700; color: var(--text); margin: 0 0 4px; }
.page-sub    { font-size: 13px; color: var(--text-muted); margin: 0; }

/* ── Layout ──────────────────────────────────────────────── */
.playground-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  align-items: start;
}

/* ── Panels ──────────────────────────────────────────────── */
.builder-panel,
.result-panel {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.panel-block { display: flex; flex-direction: column; gap: 8px; }

.field-label {
  font-size: 11px;
  font-family: var(--font-mono);
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  text-transform: uppercase;
}

/* ── Agent select ────────────────────────────────────────── */
.agent-select {
  width: 100%;
  padding: 8px 10px;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 13.5px;
  outline: none;
  cursor: pointer;
}
.agent-select:focus { border-color: var(--accent); }

/* ── Turns ───────────────────────────────────────────────── */
.turns-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.turn-add-btns { display: flex; gap: 6px; }

.add-turn-btn {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all var(--t-fast);
}
.add-turn-btn.agent-btn { background: var(--accent-dim); color: var(--accent); border-color: rgba(79,136,255,.25); }
.add-turn-btn.user-btn  { background: var(--bg-hover); color: var(--text-2); }
.add-turn-btn:hover { opacity: 0.8; }
.add-turn-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.turns-empty {
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
  padding: 20px 0;
  border: 1px dashed var(--border);
  border-radius: 8px;
}

.turns-list { display: flex; flex-direction: column; gap: 8px; }

.turn-row {
  display: grid;
  grid-template-columns: 52px 1fr 24px;
  gap: 8px;
  align-items: start;
}

.turn-speaker-badge {
  padding: 4px 6px;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
  text-align: center;
  margin-top: 6px;
}
.turn-speaker-badge.agent { background: var(--accent-dim); color: var(--accent); }
.turn-speaker-badge.user  { background: var(--bg-hover); color: var(--text-2); }

.turn-input {
  width: 100%;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
  resize: vertical;
  font-family: inherit;
  outline: none;
}
.turn-input:focus { border-color: var(--accent); }
.turn-input:disabled { opacity: 0.5; }

.turn-delete {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px 4px;
  border-radius: 4px;
  margin-top: 4px;
  transition: all var(--t-fast);
}
.turn-delete:hover { color: var(--fail); background: var(--fail-dim, rgba(239,68,68,.1)); }
.turn-delete:disabled { opacity: 0.3; cursor: not-allowed; }

/* ── Submit ──────────────────────────────────────────────── */
.run-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font-size: 13.5px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all var(--t-fast);
}
.run-btn:hover:not(:disabled) { opacity: 0.85; }
.run-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.submit-error {
  font-size: 12.5px;
  color: var(--fail);
  margin: 4px 0 0;
}

/* ── Result panel ────────────────────────────────────────── */
.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.result-status {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 99px;
  font-family: var(--font-mono);
}
.result-status.waiting { background: var(--warn-dim); color: var(--warn); display: flex; align-items: center; gap: 5px; }
.result-status.done    { background: var(--pass-dim); color: var(--pass); }
.result-status.failed  { background: rgba(239,68,68,.12); color: var(--fail); }

.pulse-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--warn);
  animation: pulse-ring 1.5s ease-in-out infinite;
}

.result-empty, .result-waiting, .result-failed {
  text-align: center;
  padding: 40px 0;
  font-size: 13px;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.spinner-lg {
  width: 32px; height: 32px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.result-failed { color: var(--fail); }

/* ── Score ───────────────────────────────────────────────── */
.result-score-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}

.big-score {
  font-size: 40px;
  font-weight: 800;
  font-family: var(--font-mono);
  line-height: 1;
}
.big-score.pass { color: var(--pass); }
.big-score.fail { color: var(--fail); }

.result-verdict {
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-mono);
  padding: 3px 8px;
  border-radius: 5px;
}
.result-verdict.pass { background: var(--pass-dim); color: var(--pass); }
.result-verdict.fail { background: rgba(239,68,68,.12); color: var(--fail); }

.result-summary {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.5;
  margin: 0 0 16px;
}

/* ── KPI bars ────────────────────────────────────────────── */
.kpi-scores { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }

.kpi-row { display: flex; flex-direction: column; gap: 4px; }

.kpi-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.kpi-goal { font-size: 12.5px; color: var(--text-2); }

.kpi-score-val {
  font-size: 12px;
  font-family: var(--font-mono);
  font-weight: 600;
}
.kpi-score-val.pass { color: var(--pass); }
.kpi-score-val.fail { color: var(--fail); }

.kpi-bar-track {
  height: 5px;
  background: var(--bg-hover);
  border-radius: 99px;
  overflow: hidden;
}

.kpi-bar-fill {
  height: 100%;
  border-radius: 99px;
  transition: width 0.4s ease;
}
.kpi-bar-fill.pass { background: var(--pass); }
.kpi-bar-fill.fail { background: var(--fail); }

/* ── Use actions ─────────────────────────────────────────── */
.use-actions-section { display: flex; flex-direction: column; gap: 6px; }

.ua-pill {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 7px;
  border-left: 3px solid var(--border);
}
.ua-pill.missed_opportunity { border-color: var(--warn); background: var(--warn-dim); }
.ua-pill.deviation          { border-color: var(--accent); background: var(--accent-dim); }
.ua-pill.escalation_needed  { border-color: var(--fail); background: rgba(239,68,68,.08); }

.ua-type {
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.ua-desc { font-size: 12.5px; color: var(--text-2); }

/* ── Animations ──────────────────────────────────────────── */
@keyframes spin { to { transform: rotate(360deg); } }
</style>
