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
              v-if="diffPanelOpen && agent?.script != null"
              :currentScript="localScript"
              :suggestions="allSuggestions"
              @save="handleDiffSave"
              @dismiss="diffPanelOpen = false"
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

      <!-- Call timeline -->
      <section class="content-section analyses-section">
        <div class="section-header">
          <h2 class="section-title">Call Analyses</h2>
          <span class="mono dim">{{ transcriptCards.length }} {{ transcriptCards.length === 1 ? 'call' : 'calls' }}</span>
        </div>

        <div v-if="!transcriptCards.length" class="empty-state">
          <p>No calls yet. Send a webhook to trigger the first analysis.</p>
        </div>

        <div class="analysis-timeline">
          <div
            v-for="tc in transcriptCards"
            :key="tc.transcriptId"
            class="analysis-card"
            :class="cardClass(tc)"
          >
            <!-- ── Card header ── -->
            <div class="analysis-header">
              <div class="analysis-meta">
                <span class="call-chip mono">{{ tc.ghlCallId || tc.transcriptId.slice(0, 8) }}</span>
                <span class="analysis-date dim">{{ formatDate(latestAnalysis(tc)?.analyzedAt ?? tc.ingestedAt) }}</span>
                <span v-if="tc.durationSeconds" class="analysis-duration dim mono">{{ formatDuration(tc.durationSeconds) }}</span>
                <span v-if="!tc.analyses.length" class="status-pill" :class="tc.transcriptStatus">
                  {{ tc.transcriptStatus === 'analysis_failed' ? 'Analysis failed' : 'Pending analysis' }}
                </span>
                <!-- Run count badge when more than one analysis -->
                <span v-if="tc.analyses.length > 1" class="run-count-chip mono">
                  {{ tc.analyses.length }} runs
                </span>
              </div>
              <div class="analysis-score-area">
                <!-- Re-analyze / Analyze button -->
                <button
                  class="reanalyze-btn"
                  :class="{ done: reanalyzeDone.has(tc.transcriptId) }"
                  :disabled="reanalyzing.has(tc.transcriptId) || reanalyzeDone.has(tc.transcriptId)"
                  @click="reanalyze(tc.transcriptId)"
                  :title="reanalyzeDone.has(tc.transcriptId) ? 'Queued — refresh in a moment' : 'Re-run with current KPIs'"
                >
                  <svg v-if="reanalyzing.has(tc.transcriptId)" width="11" height="11" viewBox="0 0 12 12" fill="none" class="spin">
                    <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="14" stroke-dashoffset="4"/>
                  </svg>
                  <svg v-else-if="reanalyzeDone.has(tc.transcriptId)" width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <svg v-else width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M10 6A4 4 0 1 1 6 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    <path d="M6 0l2 2-2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  {{ reanalyzing.has(tc.transcriptId) ? 'Queuing…' : reanalyzeDone.has(tc.transcriptId) ? 'Queued' : (tc.analyses.length ? 'Re-analyze' : 'Analyze') }}
                </button>

                <template v-if="latestAnalysis(tc)">
                  <span class="score-badge" :class="latestAnalysis(tc)!.passed ? 'pass' : 'fail'">
                    {{ latestAnalysis(tc)!.passed ? 'PASS' : 'FAIL' }}
                  </span>
                  <span class="score-value mono" :class="latestAnalysis(tc)!.passed ? 'pass' : 'fail'">
                    {{ pct(latestAnalysis(tc)!.overallScore) }}
                  </span>
                </template>
              </div>
            </div>

            <!-- ── Latest analysis body ── -->
            <template v-if="latestAnalysis(tc)">
              <p class="analysis-summary">{{ latestAnalysis(tc)!.summary }}</p>

              <div v-if="latestAnalysis(tc)!.kpiScores?.length" class="kpi-grid">
                <KpiScoreBar
                  v-for="kpi in latestAnalysis(tc)!.kpiScores"
                  :key="kpi.goal"
                  :goal="kpi.goal"
                  :score="kpi.score"
                  :passed="kpi.passed"
                  :evidence="kpi.evidence"
                />
              </div>

              <template v-if="latestAnalysis(tc)!.useActions?.length">
                <div class="use-actions-header">
                  <span class="use-actions-title">Action Items</span>
                  <span
                    v-for="(count, type) in useActionCounts(latestAnalysis(tc)!.useActions)"
                    :key="type"
                    class="ua-count-chip"
                    :class="type"
                  >{{ count }} {{ typeShort(type) }}</span>
                </div>
                <div class="use-actions">
                  <UseActionBadge
                    v-for="(ua, i) in latestAnalysis(tc)!.useActions"
                    :key="ua.id ?? i"
                    :type="ua.type"
                    :description="ua.description"
                    :turnIndex="ua.transcriptTurnIndex ?? null"
                    :actionId="ua.id ?? null"
                  />
                </div>
              </template>

              <ScriptSuggestionsPanel
                v-if="latestAnalysis(tc)!.scriptSuggestions?.length"
                :suggestions="latestAnalysis(tc)!.scriptSuggestions"
              />
            </template>

            <!-- ── Pending / failed placeholder ── -->
            <p v-else class="analysis-summary pending-msg">
              {{ tc.transcriptStatus === 'analysis_failed'
                ? 'Analysis failed. Click Re-analyze to retry with the current KPI configuration.'
                : 'Waiting for analysis. The Temporal worker will pick this up shortly, or click Analyze to re-queue.' }}
            </p>

            <!-- ── Previous runs ── -->
            <div v-if="tc.analyses.length > 1" class="prev-runs">
              <button class="prev-runs-toggle" @click="toggleHistory(tc.transcriptId)">
                <svg
                  width="12" height="12" viewBox="0 0 12 12" fill="none"
                  :style="{ transform: historyOpen.has(tc.transcriptId) ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }"
                >
                  <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                {{ historyOpen.has(tc.transcriptId) ? 'Hide' : 'Show' }} {{ tc.analyses.length - 1 }} previous {{ tc.analyses.length - 1 === 1 ? 'run' : 'runs' }}
              </button>

              <Transition name="slide">
                <div v-if="historyOpen.has(tc.transcriptId)" class="prev-runs-list">
                  <div
                    v-for="(run, ri) in tc.analyses.slice(1)"
                    :key="run.id"
                    class="prev-run-item"
                    :class="run.passed ? 'pass' : 'fail'"
                  >
                    <div class="prev-run-header">
                      <span class="prev-run-label mono">Run #{{ tc.analyses.length - 1 - ri }}</span>
                      <span class="prev-run-date dim">{{ formatDate(run.analyzedAt) }}</span>
                      <span class="prev-run-score mono" :class="run.passed ? 'pass' : 'fail'">{{ pct(run.overallScore) }}</span>
                      <span class="score-badge sm" :class="run.passed ? 'pass' : 'fail'">{{ run.passed ? 'PASS' : 'FAIL' }}</span>
                    </div>
                    <p class="prev-run-summary">{{ run.summary }}</p>
                    <div v-if="run.kpiScores?.length" class="kpi-grid compact">
                      <KpiScoreBar
                        v-for="kpi in run.kpiScores"
                        :key="kpi.goal"
                        :goal="kpi.goal"
                        :score="kpi.score"
                        :passed="kpi.passed"
                        :evidence="kpi.evidence"
                      />
                    </div>
                  </div>
                </div>
              </Transition>
            </div>

            <!-- ── Transcript toggle ── -->
            <button
              v-if="tc.turns?.length"
              class="transcript-toggle"
              @click="toggleTranscript(tc.transcriptId)"
            >
              <svg
                width="14" height="14" viewBox="0 0 14 14" fill="none"
                :style="{ transform: openTranscripts.has(tc.transcriptId) ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }"
              >
                <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              {{ openTranscripts.has(tc.transcriptId) ? 'Hide transcript' : 'View transcript' }}
              <span class="turn-count mono">{{ tc.turns.length }} turns</span>
            </button>

            <Transition name="transcript-slide">
              <div v-if="openTranscripts.has(tc.transcriptId)" class="transcript-wrap">
                <TranscriptViewer
                  :turns="tc.turns"
                  :useActions="latestAnalysis(tc)?.useActions ?? []"
                />
              </div>
            </Transition>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { agentsApi } from '../api/agents'
import { analysisApi } from '../api/analysis'
import { kpiApi } from '../api/kpi'
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

// Expanded sets
const openTranscripts = ref<Set<string>>(new Set())
const historyOpen = ref<Set<string>>(new Set())

// Re-analyze state keyed by transcriptId
const reanalyzing = ref<Set<string>>(new Set())
const reanalyzeDone = ref<Set<string>>(new Set())

// Script diff panel state
const diffPanelOpen = ref(false)

// Escalation banner state
const bannerDismissed = ref(false)

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

// Collect all unique script suggestions from the latest analysis of each transcript card
const allSuggestions = computed((): ScriptSuggestion[] => {
  const seen = new Set<string>()
  const result: ScriptSuggestion[] = []
  for (const tc of transcriptCards.value) {
    const latest = latestAnalysis(tc)
    if (!latest) continue
    for (const s of latest.scriptSuggestions ?? []) {
      const key = `${s.sectionTitle}::${s.issue}`
      if (!seen.has(key)) {
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

function toggleTranscript(transcriptId: string) {
  const s = new Set(openTranscripts.value)
  s.has(transcriptId) ? s.delete(transcriptId) : s.add(transcriptId)
  openTranscripts.value = s
}

function toggleHistory(transcriptId: string) {
  const s = new Set(historyOpen.value)
  s.has(transcriptId) ? s.delete(transcriptId) : s.add(transcriptId)
  historyOpen.value = s
}

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

async function handleDiffSave(newScript: string) {
  savingScript.value = true
  scriptSaved.value  = false
  try {
    await agentsApi.updateScript(id, props.locationId, newScript)
    localScript.value = newScript
    if (agent.value) agent.value = { ...agent.value, script: newScript }
    diffPanelOpen.value = false
    scriptSaved.value   = true
    setTimeout(() => { scriptSaved.value = false }, 2500)
  } finally {
    savingScript.value = false
  }
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
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
.analyses-section { margin-bottom: 0; }

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.section-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-2);
}

/* ── Analysis timeline ───────────────────────────────────── */
.analysis-timeline {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.analysis-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: fade-up 300ms ease-out both;
  border-left-width: 3px;
}

.analysis-card.pass { border-left-color: var(--pass); }
.analysis-card.fail { border-left-color: var(--fail); }
.analysis-card.pending { border-left-color: var(--warn); opacity: 0.85; }

/* ── Card header ─────────────────────────────────────────── */
.analysis-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.analysis-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.call-chip {
  font-size: 11px;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  padding: 2px 8px;
  border-radius: 4px;
  color: var(--text-2);
}

.analysis-date, .analysis-duration { font-size: 12px; }

.analysis-score-area {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.score-badge {
  font-size: 9.5px;
  font-family: var(--font-mono);
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 3px 8px;
  border-radius: 4px;
}

.score-badge.pass { background: var(--pass-dim); color: var(--pass); border: 1px solid rgba(0,201,141,0.2); }
.score-badge.fail { background: var(--fail-dim); color: var(--fail); border: 1px solid rgba(255,65,105,0.2); }
.score-badge.sm { font-size: 8.5px; padding: 2px 6px; }

.score-value { font-size: 18px; font-weight: 600; line-height: 1; }
.score-value.pass { color: var(--pass); }
.score-value.fail { color: var(--fail); }

/* ── Spinner ─────────────────────────────────────────────── */
.spin { animation: spin 0.8s linear infinite; }

/* ── Re-analyze button ───────────────────────────────────── */
.reanalyze-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-hover);
  color: var(--text-2);
  cursor: pointer;
  transition: all var(--t-fast);
}

.reanalyze-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(79, 136, 255, 0.08);
}

.reanalyze-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.reanalyze-btn.done {
  border-color: var(--pass);
  color: var(--pass);
  background: var(--pass-dim);
}

/* ── Status pill ─────────────────────────────────────────── */
.status-pill {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 99px;
}

.status-pill.pending {
  background: rgba(255, 171, 46, 0.12);
  color: var(--warn);
  border: 1px solid rgba(255, 171, 46, 0.3);
}

.status-pill.analysis_failed {
  background: var(--fail-dim);
  color: var(--fail);
  border: 1px solid rgba(255, 65, 105, 0.3);
}

/* ── Run count badge ─────────────────────────────────────── */
.run-count-chip {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 99px;
  background: rgba(79, 136, 255, 0.1);
  color: var(--accent);
  border: 1px solid rgba(79, 136, 255, 0.2);
}

/* ── Summary ─────────────────────────────────────────────── */
.analysis-summary {
  font-size: 13.5px;
  color: var(--text-2);
  line-height: 1.65;
}

.pending-msg { color: var(--text-muted); font-style: italic; }

/* ── KPI grid ────────────────────────────────────────────── */
.kpi-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.kpi-grid.compact { padding: 10px 12px; gap: 8px; }

/* ── Use actions ─────────────────────────────────────────── */
.use-actions-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.use-actions-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-muted);
}

.ua-count-chip {
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 99px;
}

.ua-count-chip.missed_opportunity { background: rgba(255, 171, 46, 0.12); color: var(--warn); border: 1px solid rgba(255, 171, 46, 0.25); }
.ua-count-chip.deviation { background: rgba(79, 136, 255, 0.12); color: var(--accent); border: 1px solid rgba(79, 136, 255, 0.25); }
.ua-count-chip.escalation_needed { background: var(--fail-dim); color: var(--fail); border: 1px solid rgba(255, 65, 105, 0.25); }

.use-actions { display: flex; flex-direction: column; gap: 6px; }

/* ── Previous runs ───────────────────────────────────────── */
.prev-runs { display: flex; flex-direction: column; gap: 10px; }

.prev-runs-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 5px 12px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--t-fast);
  align-self: flex-start;
}

.prev-runs-toggle:hover { color: var(--text-2); border-color: var(--text-muted); background: var(--bg-hover); }

.prev-runs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-left: 2px solid var(--border-subtle);
  padding-left: 14px;
  margin-left: 4px;
}

.prev-run-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  border-left-width: 3px;
}

.prev-run-item.pass { border-left-color: var(--pass); }
.prev-run-item.fail { border-left-color: var(--fail); }

.prev-run-header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.prev-run-label { font-size: 11px; font-weight: 700; color: var(--text-2); }
.prev-run-date { font-size: 11px; }
.prev-run-score { font-size: 14px; font-weight: 600; }
.prev-run-score.pass { color: var(--pass); }
.prev-run-score.fail { color: var(--fail); }

.prev-run-summary {
  font-size: 12.5px;
  color: var(--text-muted);
  line-height: 1.6;
  margin: 0;
}

/* ── Transcript toggle ───────────────────────────────────── */
.transcript-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
  cursor: pointer;
  transition: all var(--t-fast);
  align-self: flex-start;
}

.transcript-toggle:hover { background: var(--bg-hover); border-color: var(--text-muted); color: var(--text); }

.turn-count {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-hover);
  padding: 1px 6px;
  border-radius: 99px;
  margin-left: 2px;
}

/* ── Transcript wrap ─────────────────────────────────────── */
.transcript-wrap {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-surface);
}

/* ── Slide transition (prev runs) ────────────────────────── */
.slide-enter-active, .slide-leave-active { transition: all 220ms ease; overflow: hidden; }
.slide-enter-from, .slide-leave-to { opacity: 0; max-height: 0; }
.slide-enter-to, .slide-leave-from { opacity: 1; max-height: 3000px; }

/* ── Transcript slide transition ─────────────────────────── */
.transcript-slide-enter-active, .transcript-slide-leave-active { transition: all 250ms ease; overflow: hidden; }
.transcript-slide-enter-from, .transcript-slide-leave-to { opacity: 0; max-height: 0; }
.transcript-slide-enter-to, .transcript-slide-leave-from { opacity: 1; max-height: 2000px; }

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
  color: var(--text-muted);
  font-size: 14px;
  text-align: center;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
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
</style>
