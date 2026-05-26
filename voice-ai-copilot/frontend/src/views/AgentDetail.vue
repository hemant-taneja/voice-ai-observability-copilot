<template>
  <div class="agent-detail">

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="skeleton-header" />
      <div class="skeleton-cards">
        <div class="skeleton-card" v-for="i in 3" :key="i" />
      </div>
    </div>

    <div v-else-if="error" class="error-state">{{ error }}</div>

    <template v-else-if="agent">
      <!-- Page header -->
      <header class="page-header">
        <div class="header-left">
          <button class="back-btn" @click="$router.push({ path: '/', query: { locationId } })">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div>
            <h1 class="agent-name">{{ agent.name }}</h1>
            <div class="agent-meta-row">
              <span class="mono dim">{{ agent.totalCalls }} calls analyzed</span>
              <span class="separator">·</span>
              <span class="status-chip" :class="agentHealth">
                {{ agentHealth === 'pass' ? '● Passing' : agentHealth === 'fail' ? '● Failing' : '● No data' }}
              </span>
            </div>
          </div>
        </div>
      </header>

      <!-- Escalation banner -->
      <div
        v-if="unhandledEscalationCount > 0 && !bannerDismissed"
        class="escalation-banner"
      >
        <span class="escalation-banner-icon">&#9888;</span>
        <span class="escalation-banner-text">
          {{ unhandledEscalationCount }} unhandled escalation{{ unhandledEscalationCount !== 1 ? 's' : '' }} require human review
        </span>
        <button class="escalation-banner-dismiss" @click="dismissEscalationBanner" title="Dismiss for this session">&#x2715;</button>
      </div>

      <!-- Script editor -->
      <section class="content-section">
        <div class="script-editor-card">
          <button class="script-toggle" @click="scriptOpen = !scriptOpen">
            <div class="toggle-left">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 4h10M2 7h7M2 10h5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
              <span>Agent Script</span>
              <span v-if="agent.script" class="script-badge mono">set</span>
              <span v-else class="script-badge mono empty">not set</span>
            </div>
            <svg
              class="chevron"
              width="14" height="14" viewBox="0 0 14 14" fill="none"
              :style="{ transform: scriptOpen ? 'rotate(180deg)' : 'none' }"
            >
              <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div v-if="scriptOpen" class="script-body">
            <p class="script-hint">
              The agent's instructions or call script. This is sent to the LLM alongside the transcript for analysis,
              and used to detect deviations. Saving triggers re-suggestion of KPI goals if the script changes significantly.
            </p>
            <textarea
              v-model="localScript"
              class="script-textarea"
              placeholder="Paste the agent's script or instructions here…"
              rows="10"
            />
            <!-- Suggested changes button -->
            <div v-if="allSuggestions.length && !diffPanelOpen" class="suggest-changes-bar">
              <button class="suggest-changes-btn" @click="diffPanelOpen = true">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M2 4h10M2 7h7M2 10h5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                </svg>
                View Suggested Changes ({{ allSuggestions.length }})
              </button>
            </div>

            <!-- Inline diff panel -->
            <ScriptDiffPanel
              v-if="diffPanelOpen"
              :currentScript="localScript"
              :suggestions="allSuggestions"
              @save="handleDiffSave"
              @dismiss="handleDiffDismiss"
            />

            <div class="script-footer">
              <button class="save-script-btn" :disabled="savingScript" @click="saveScript">
                <svg v-if="savingScript" width="12" height="12" viewBox="0 0 12 12" fill="none" class="spin">
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="14" stroke-dashoffset="4"/>
                </svg>
                {{ savingScript ? 'Saving…' : 'Save Script' }}
              </button>
              <span v-if="scriptSaved" class="script-saved-msg">Saved</span>
            </div>
          </div>
        </div>
      </section>

      <!-- KPI Config -->
      <section class="content-section">
        <KpiConfigEditor
          :agentId="id"
          :locationId="locationId"
          :initialGoals="kpiConfig?.goals ?? []"
          :initialThreshold="kpiConfig?.successThreshold ?? 0.7"
          @save="handleKpiSave"
        />
      </section>

      <!-- Recommendations -->
      <section v-if="latestFailedKpis.length" class="content-section">
        <RecommendationPanel :recommendations="latestFailedKpis" />
      </section>

      <!-- Transcript table -->
      <section class="content-section">
        <div class="section-header-row">
          <h2 class="section-title">Call Transcripts</h2>
          <span class="section-count mono">{{ transcriptCards.length }}</span>
        </div>

        <div v-if="transcriptCards.length === 0" class="empty-state">
          No transcripts yet — run a simulation to get started.
        </div>

        <table v-else class="transcript-table">
          <thead>
            <tr>
              <th>Score</th>
              <th>Result</th>
              <th>Date</th>
              <th>Duration</th>
              <th>Actions</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="tc in transcriptCards"
              :key="tc.transcriptId"
              class="transcript-row"
              :class="cardClass(tc)"
              @click="openDrawer(tc)"
            >
              <td class="col-score">
                <span v-if="latestAnalysis(tc)" class="score-val" :class="latestAnalysis(tc)!.passed ? 'pass' : 'fail'">
                  {{ pct(latestAnalysis(tc)!.overallScore) }}
                </span>
                <span v-else class="score-val pending">—</span>
              </td>
              <td class="col-result">
                <span v-if="latestAnalysis(tc)" class="result-chip" :class="latestAnalysis(tc)!.passed ? 'pass' : 'fail'">
                  {{ latestAnalysis(tc)!.passed ? 'Pass' : 'Fail' }}
                </span>
                <span v-else class="result-chip pending">Pending</span>
              </td>
              <td class="col-date mono">{{ formatDate(tc.ingestedAt) }}</td>
              <td class="col-duration mono">{{ formatDuration(tc.durationSeconds) }}</td>
              <td class="col-actions">
                <span
                  v-for="(count, type) in useActionCounts(latestAnalysis(tc)?.useActions ?? [])"
                  :key="type"
                  class="ua-pill"
                  :class="type"
                >
                  {{ count }} {{ typeShort(type) }}
                </span>
              </td>
              <td class="col-chevron">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Detail drawer -->
      <Teleport to="body">
        <Transition name="drawer">
          <div v-if="drawerOpen" class="drawer-overlay" @click.self="closeDrawer">
            <div class="drawer-panel" @click.stop>
              <div class="drawer-header">
                <div class="drawer-title-row">
                  <span class="drawer-title">Call Analysis</span>
                  <span v-if="drawerCard && latestAnalysis(drawerCard)" class="result-chip" :class="latestAnalysis(drawerCard)!.passed ? 'pass' : 'fail'">
                    {{ latestAnalysis(drawerCard)!.passed ? 'Pass' : 'Fail' }}
                  </span>
                </div>
                <button class="drawer-close" @click="closeDrawer">✕</button>
              </div>

              <div v-if="drawerCard" class="drawer-body">
                <!-- Score + meta -->
                <div class="drawer-meta">
                  <div class="drawer-meta-item">
                    <span class="meta-label">Score</span>
                    <span class="meta-val score-large" :class="latestAnalysis(drawerCard)?.passed ? 'pass' : 'fail'">
                      {{ latestAnalysis(drawerCard) ? pct(latestAnalysis(drawerCard)!.overallScore) : '—' }}
                    </span>
                  </div>
                  <div class="drawer-meta-item">
                    <span class="meta-label">Date</span>
                    <span class="meta-val mono">{{ formatDate(drawerCard.ingestedAt) }}</span>
                  </div>
                  <div class="drawer-meta-item">
                    <span class="meta-label">Duration</span>
                    <span class="meta-val mono">{{ formatDuration(drawerCard.durationSeconds) }}</span>
                  </div>
                  <div class="drawer-meta-item">
                    <span class="meta-label">Model</span>
                    <span class="meta-val mono">{{ (latestAnalysis(drawerCard) as any)?.llmModel ?? '—' }}</span>
                  </div>
                </div>

                <!-- Summary -->
                <div v-if="latestAnalysis(drawerCard)?.summary" class="drawer-block">
                  <h3 class="drawer-block-title">Summary</h3>
                  <p class="drawer-summary">{{ latestAnalysis(drawerCard)!.summary }}</p>
                </div>

                <!-- KPI Scores -->
                <div v-if="latestAnalysis(drawerCard)?.kpiScores?.length" class="drawer-block">
                  <h3 class="drawer-block-title">KPI Scores</h3>
                  <div class="kpi-score-list">
                    <div
                      v-for="k in latestAnalysis(drawerCard)!.kpiScores"
                      :key="k.goal"
                      class="kpi-score-row"
                      :class="k.passed ? 'pass' : 'fail'"
                    >
                      <div class="kpi-score-top">
                        <span class="kpi-goal-name">{{ k.goal }}</span>
                        <span class="kpi-score-val" :class="k.passed ? 'pass' : 'fail'">{{ pct(k.score) }}</span>
                      </div>
                      <p v-if="k.evidence" class="kpi-evidence">{{ k.evidence }}</p>
                    </div>
                  </div>
                </div>

                <!-- Use Actions -->
                <div v-if="latestAnalysis(drawerCard)?.useActions?.length" class="drawer-block">
                  <h3 class="drawer-block-title">Use Actions</h3>
                  <div class="use-actions-list">
                    <UseActionBadge
                      v-for="ua in latestAnalysis(drawerCard)!.useActions"
                      :key="ua.id ?? ua.description"
                      :type="ua.type"
                      :description="ua.description"
                      :turnIndex="ua.transcriptTurnIndex"
                      :actionId="ua.id"
                    />
                  </div>
                </div>

                <!-- Transcript -->
                <div class="drawer-block">
                  <h3 class="drawer-block-title">Transcript</h3>
                  <TranscriptViewer
                    :turns="drawerCard.turns"
                    :useActions="latestAnalysis(drawerCard)?.useActions ?? []"
                  />
                </div>

                <!-- Re-analyze -->
                <div class="drawer-footer">
                  <button
                    class="reanalyze-btn"
                    :disabled="reanalyzing.has(drawerCard.transcriptId)"
                    @click="reanalyze(drawerCard.transcriptId)"
                  >
                    <svg v-if="reanalyzing.has(drawerCard.transcriptId)" width="12" height="12" viewBox="0 0 12 12" fill="none" class="spin">
                      <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="14" stroke-dashoffset="4"/>
                    </svg>
                    {{ reanalyzing.has(drawerCard.transcriptId) ? 'Re-analyzing…' : reanalyzeDone.has(drawerCard.transcriptId) ? 'Queued ✓' : 'Re-analyze' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { agentsApi } from '../api/agents'
import { analysisApi } from '../api/analysis'
import { kpiApi } from '../api/kpi'
import { useStreamStore } from '../stores/stream'
import type { AgentDetail } from '../types/agent.types'
import type { KpiConfig, KpiGoal, KpiScore, TranscriptCard, AnalysisVersion, UseAction, ScriptSuggestion } from '../types/analysis.types'
import UseActionBadge from '../components/UseActionBadge.vue'
import KpiConfigEditor from '../components/KpiConfigEditor.vue'
import RecommendationPanel from '../components/RecommendationPanel.vue'
import KpiScoreBar from '../components/KpiScoreBar.vue'
import TranscriptViewer from '../components/TranscriptViewer.vue'
import ScriptSuggestionsPanel from '../components/ScriptSuggestionsPanel.vue'
import ScriptDiffPanel from '../components/ScriptDiffPanel.vue'

const props = defineProps<{ locationId: string }>()

const route = useRoute()
const id = route.params.id as string

const agent = ref<AgentDetail | null>(null)
const transcriptCards = ref<TranscriptCard[]>([])
const kpiConfig = ref<KpiConfig | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

// Script editor state
const scriptOpen = ref(false)
const localScript = ref('')
const savingScript = ref(false)
const scriptSaved = ref(false)

// Re-analyze state keyed by transcriptId
const reanalyzing = ref<Set<string>>(new Set())
const reanalyzeDone = ref<Set<string>>(new Set())

// Script diff panel state
const diffPanelOpen = ref(false)

// Suggestions hidden after dismiss or save (keyed by sectionTitle::issue, persisted per agent)
const hiddenSuggestionKeys = ref<Set<string>>(new Set())

// Escalation banner state
const bannerDismissed = ref(false)

// Drawer state
const drawerOpen = ref(false)
const drawerCard = ref<TranscriptCard | null>(null)

function openDrawer(tc: TranscriptCard) {
  drawerCard.value = tc
  drawerOpen.value = true
}

function closeDrawer() {
  drawerOpen.value = false
  // keep drawerCard alive until transition ends
  setTimeout(() => { drawerCard.value = null }, 300)
}

// SSE live refresh — when an analysis.complete/failed event arrives for this
// agent, re-fetch transcript cards and sync the open drawer card in place.
const streamStore = useStreamStore()

watch(() => streamStore.lastEvent, async (event) => {
  if (!event || !agent.value) return
  if (event.agentId !== agent.value.ghlAgentId) return
  if (event.type !== 'analysis.complete' && event.type !== 'analysis.failed') return

  const [fresh, freshAgent] = await Promise.all([
    analysisApi.getByAgent(id, props.locationId),
    agentsApi.getById(id, props.locationId),
  ])
  transcriptCards.value = fresh
  agent.value = freshAgent

  // Sync the open drawer card so analysis renders without closing it
  if (drawerCard.value) {
    const updated = fresh.find((tc) => tc.transcriptId === drawerCard.value!.transcriptId)
    if (updated) drawerCard.value = updated
  }
})

onMounted(async () => {
  try {
    const [agentRes, cardsRes, kpiRes] = await Promise.allSettled([
      agentsApi.getById(id, props.locationId),
      analysisApi.getByAgent(id, props.locationId),
      kpiApi.get(id, props.locationId),
    ])

    if (agentRes.status === 'fulfilled') {
      agent.value = agentRes.value
      localScript.value = agentRes.value.script ?? ''
    } else {
      error.value = 'Failed to load agent'
    }

    if (cardsRes.status === 'fulfilled') transcriptCards.value = cardsRes.value
    if (kpiRes.status === 'fulfilled') kpiConfig.value = kpiRes.value
  } finally {
    loading.value = false
    bannerDismissed.value = sessionStorage.getItem(`escalation-banner-dismissed-${id}`) === '1'
    const storedHidden = localStorage.getItem(`sg-hidden-${id}`)
    if (storedHidden) hiddenSuggestionKeys.value = new Set(JSON.parse(storedHidden))
  }
})

// ── Helpers ─────────────────────────────────────────────────

function latestAnalysis(tc: TranscriptCard): AnalysisVersion | null {
  return tc.analyses[0] ?? null
}

function cardClass(tc: TranscriptCard): string {
  if (!tc.analyses.length) return 'pending'
  return latestAnalysis(tc)!.passed ? 'pass' : 'fail'
}

const agentHealth = computed(() => {
  if (agent.value?.passRate === null || agent.value?.passRate === undefined) return 'unknown'
  return agent.value.passRate >= 0.7 ? 'pass' : 'fail'
})

// Collect all unique script suggestions from the latest analysis of each transcript card,
// excluding any that were previously dismissed or applied (persisted in localStorage)
const allSuggestions = computed((): ScriptSuggestion[] => {
  const seen = new Set<string>()
  const result: ScriptSuggestion[] = []
  for (const tc of transcriptCards.value) {
    const latest = latestAnalysis(tc)
    if (!latest) continue
    for (const s of latest.scriptSuggestions ?? []) {
      const key = `${s.sectionTitle}::${s.issue}`
      if (!seen.has(key) && !hiddenSuggestionKeys.value.has(key)) {
        seen.add(key)
        result.push(s)
      }
    }
  }
  return result
})

// Count escalation_needed actions that have not been marked as handled
const unhandledEscalationCount = computed((): number => {
  let count = 0
  for (const tc of transcriptCards.value) {
    const latest = latestAnalysis(tc)
    if (!latest) continue
    for (const ua of latest.useActions ?? []) {
      if (ua.type === 'escalation_needed') {
        const handled = ua.id
          ? localStorage.getItem(`ua-escalation-handled-${ua.id}`) === 'true'
          : false
        if (!handled) count++
      }
    }
  }
  return count
})

const latestFailedKpis = computed<KpiScore[]>(() => {
  const first = transcriptCards.value.find((tc) => tc.analyses.length > 0)
  if (!first) return []
  return (first.analyses[0].kpiScores ?? []).filter((k) => !k.passed)
})

async function saveScript() {
  savingScript.value = true
  scriptSaved.value = false
  try {
    await agentsApi.updateScript(id, props.locationId, localScript.value)
    if (agent.value) agent.value = { ...agent.value, script: localScript.value }
    scriptSaved.value = true
    setTimeout(() => { scriptSaved.value = false }, 2500)
  } finally {
    savingScript.value = false
  }
}

async function handleKpiSave(goals: KpiGoal[], threshold: number) {
  kpiConfig.value = await kpiApi.upsert(id, props.locationId, goals, threshold)
}

async function reanalyze(transcriptId: string) {
  if (reanalyzing.value.has(transcriptId)) return
  const s = new Set(reanalyzing.value)
  s.add(transcriptId)
  reanalyzing.value = s
  try {
    await analysisApi.reanalyze(id, transcriptId, props.locationId)
    const done = new Set(reanalyzeDone.value)
    done.add(transcriptId)
    reanalyzeDone.value = done
  } finally {
    const s2 = new Set(reanalyzing.value)
    s2.delete(transcriptId)
    reanalyzing.value = s2
  }
}

function persistHiddenSuggestions(suggestions: ScriptSuggestion[]) {
  const updated = new Set(hiddenSuggestionKeys.value)
  for (const s of suggestions) updated.add(`${s.sectionTitle}::${s.issue}`)
  hiddenSuggestionKeys.value = updated
  localStorage.setItem(`sg-hidden-${id}`, JSON.stringify([...updated]))
}

async function handleDiffSave(newScript: string) {
  savingScript.value = true
  scriptSaved.value  = false
  try {
    await agentsApi.updateScript(id, props.locationId, newScript)
    localScript.value = newScript
    if (agent.value) agent.value = { ...agent.value, script: newScript }
    persistHiddenSuggestions(allSuggestions.value)
    diffPanelOpen.value = false
    scriptSaved.value   = true
    setTimeout(() => { scriptSaved.value = false }, 2500)
  } finally {
    savingScript.value = false
  }
}

function handleDiffDismiss() {
  persistHiddenSuggestions(allSuggestions.value)
  diffPanelOpen.value = false
}

function dismissEscalationBanner() {
  bannerDismissed.value = true
  sessionStorage.setItem(`escalation-banner-dismissed-${id}`, '1')
}

function useActionCounts(actions: UseAction[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const ua of actions) counts[ua.type] = (counts[ua.type] ?? 0) + 1
  return counts
}

function typeShort(type: string): string {
  return { missed_opportunity: 'missed', deviation: 'deviations', escalation_needed: 'escalations' }[type] ?? type
}

function pct(score: number): string {
  return `${Math.round(score * 100)}%`
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}
</script>

<style scoped>
.agent-detail {
  padding: 28px 32px;
  max-width: 900px;
}

/* ── Header ──────────────────────────────────────────────── */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.back-btn {
  margin-top: 4px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: none;
  color: var(--text-2);
  cursor: pointer;
  transition: all var(--t-fast);
  flex-shrink: 0;
}

.back-btn:hover { background: var(--bg-hover); border-color: var(--text-muted); color: var(--text); }

.agent-name {
  font-size: 24px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.025em;
  line-height: 1.2;
}

.agent-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.dim { color: var(--text-muted); font-size: 12px; }
.separator { color: var(--border); }

.status-chip { font-size: 12px; font-weight: 600; }
.status-chip.pass { color: var(--pass); }
.status-chip.fail { color: var(--fail); }
.status-chip.unknown { color: var(--text-muted); }

/* ── Script editor ───────────────────────────────────────── */
.script-editor-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--bg-card);
}

.script-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: none;
  border: none;
  color: var(--text-2);
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast);
}

.script-toggle:hover { background: var(--bg-hover); color: var(--text); }

.toggle-left { display: flex; align-items: center; gap: 8px; }

.script-badge {
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 99px;
  background: var(--pass-dim);
  color: var(--pass);
  border: 1px solid rgba(0, 201, 141, 0.2);
}

.script-badge.empty {
  background: var(--bg-hover);
  color: var(--text-muted);
  border-color: var(--border);
}

.chevron { color: var(--text-muted); transition: transform 200ms ease; flex-shrink: 0; }

.script-body {
  padding: 14px 18px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.script-hint {
  font-size: 11.5px;
  color: var(--text-muted);
  line-height: 1.55;
  margin: 0;
}

.script-textarea {
  width: 100%;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  resize: vertical;
  box-sizing: border-box;
  transition: border-color var(--t-fast);
}

.script-textarea::placeholder { color: var(--text-muted); }
.script-textarea:focus { outline: none; border-color: var(--accent); }

.script-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-end;
}

.save-script-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: var(--accent);
  border: none;
  border-radius: var(--radius-sm);
  padding: 8px 18px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--t-fast);
}

.save-script-btn:hover:not(:disabled) { opacity: 0.9; }
.save-script-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.script-saved-msg { font-size: 12px; color: var(--pass); font-weight: 600; }

/* ── Content sections ────────────────────────────────────── */
.content-section { margin-bottom: 20px; }

/* ── Spinner ─────────────────────────────────────────────── */
.spin { animation: spin 0.8s linear infinite; }

/* ── Loading ─────────────────────────────────────────────── */
.loading-state { padding: 28px 32px; }

.skeleton-header {
  height: 70px;
  border-radius: var(--radius-lg);
  background: linear-gradient(90deg, var(--bg-card) 25%, var(--bg-hover) 50%, var(--bg-card) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
  margin-bottom: 20px;
}

.skeleton-cards { display: flex; flex-direction: column; gap: 10px; }

.skeleton-card {
  height: 160px;
  border-radius: var(--radius-lg);
  background: linear-gradient(90deg, var(--bg-card) 25%, var(--bg-hover) 50%, var(--bg-card) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
}

.skeleton-card:nth-child(2) { animation-delay: 0.1s; }
.skeleton-card:nth-child(3) { animation-delay: 0.2s; }

/* ── Error / empty ───────────────────────────────────────── */
.error-state { padding: 48px 32px; color: var(--fail); font-size: 14px; }

.empty-state {
  padding: 32px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

/* ── Escalation banner ───────────────────────────────────── */
.escalation-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  margin-bottom: 16px;
  background: var(--fail-dim);
  border: 1px solid rgba(255, 65, 105, 0.3);
  border-radius: var(--radius-md);
  color: var(--fail);
  font-size: 13px;
  font-weight: 500;
}

.escalation-banner-icon { font-size: 14px; flex-shrink: 0; }

.escalation-banner-text { flex: 1; }

.escalation-banner-dismiss {
  background: none;
  border: none;
  color: var(--fail);
  cursor: pointer;
  font-size: 13px;
  padding: 0 4px;
  opacity: 0.6;
  transition: opacity var(--t-fast);
  flex-shrink: 0;
}

.escalation-banner-dismiss:hover { opacity: 1; }

/* ── Suggest changes bar ─────────────────────────────────── */
.suggest-changes-bar {
  display: flex;
  align-items: center;
}

.suggest-changes-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-sans);
  color: var(--accent);
  background: rgba(79, 136, 255, 0.08);
  border: 1px solid rgba(79, 136, 255, 0.25);
  border-radius: var(--radius-sm);
  padding: 6px 14px;
  cursor: pointer;
  transition: all var(--t-fast);
}

.suggest-changes-btn:hover {
  background: rgba(79, 136, 255, 0.14);
  border-color: rgba(79, 136, 255, 0.4);
}

/* ── Transcript table ────────────────────────────────────── */
.section-header-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-2);
  margin: 0;
}

.section-count {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-card);
  border: 1px solid var(--border);
  padding: 1px 8px;
  border-radius: 99px;
}

.transcript-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  font-size: 13px;
}

.transcript-table thead tr {
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
}

.transcript-table th {
  padding: 9px 14px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.transcript-row {
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: background var(--t-fast);
}

.transcript-row:last-child { border-bottom: none; }
.transcript-row:hover { background: var(--bg-hover); }

.transcript-table td {
  padding: 11px 14px;
  vertical-align: middle;
}

.col-score { width: 72px; }
.col-result { width: 80px; }
.col-date { width: 150px; }
.col-duration { width: 80px; }
.col-chevron { width: 32px; text-align: right; color: var(--text-muted); }

.score-val {
  font-size: 14px;
  font-weight: 700;
  font-family: var(--font-mono);
}

.score-val.pass { color: var(--pass); }
.score-val.fail { color: var(--fail); }
.score-val.pending { color: var(--text-muted); }

.result-chip {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 99px;
}

.result-chip.pass { background: rgba(var(--pass-rgb, 34,197,94), 0.12); color: var(--pass); }
.result-chip.fail { background: rgba(var(--fail-rgb, 255,65,105), 0.12); color: var(--fail); }
.result-chip.pending { background: var(--bg-surface); color: var(--text-muted); border: 1px solid var(--border); }

.ua-pill {
  display: inline-block;
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 99px;
  margin-right: 4px;
  white-space: nowrap;
}

.ua-pill.missed_opportunity { background: rgba(245,158,11,0.12); color: var(--warn); }
.ua-pill.deviation          { background: rgba(79,136,255,0.1);  color: var(--accent); }
.ua-pill.escalation_needed  { background: rgba(255,65,105,0.1);  color: var(--fail); }

/* ── Right drawer ────────────────────────────────────────── */
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}

.drawer-panel {
  width: 700px;
  max-width: 90vw;
  height: 100%;
  background: var(--bg);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-card);
  flex-shrink: 0;
}

.drawer-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.drawer-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-2);
}

.drawer-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: all var(--t-fast);
}

.drawer-close:hover { background: var(--bg-hover); color: var(--text-2); }

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.drawer-meta {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 14px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.drawer-meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.meta-val {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}

.score-large {
  font-size: 22px;
  font-family: var(--font-mono);
  font-weight: 700;
}

.score-large.pass { color: var(--pass); }
.score-large.fail { color: var(--fail); }

.drawer-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.drawer-block-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  margin: 0;
}

.drawer-summary {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-2);
  margin: 0;
  padding: 12px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.kpi-score-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kpi-score-row {
  padding: 10px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  border-left-width: 3px;
}

.kpi-score-row.pass { border-left-color: var(--pass); }
.kpi-score-row.fail { border-left-color: var(--fail); }

.kpi-score-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.kpi-goal-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}

.kpi-score-val {
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-mono);
}

.kpi-score-val.pass { color: var(--pass); }
.kpi-score-val.fail { color: var(--fail); }

.kpi-evidence {
  font-size: 12px;
  color: var(--text-muted);
  margin: 6px 0 0;
  line-height: 1.5;
}

.use-actions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drawer-footer {
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.reanalyze-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-sans);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 7px 16px;
  color: var(--text-2);
  cursor: pointer;
  transition: all var(--t-fast);
}

.reanalyze-btn:hover:not(:disabled) { background: var(--bg-hover); border-color: var(--accent); color: var(--accent); }
.reanalyze-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Drawer slide transition */
.drawer-enter-active, .drawer-leave-active { transition: all 280ms ease; }
.drawer-enter-from .drawer-panel, .drawer-leave-to .drawer-panel { transform: translateX(100%); }
.drawer-enter-from, .drawer-leave-to { background: rgba(0, 0, 0, 0); }
</style>
