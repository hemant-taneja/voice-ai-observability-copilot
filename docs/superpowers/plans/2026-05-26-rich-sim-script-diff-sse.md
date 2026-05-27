# Rich Simulation Cases, Script Diff UI, Escalation Handling & SSE Toast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 richer simulator test cases that reliably trigger use actions and script suggestions; add an inline script diff panel to the agent script editor; add "Mark as handled" for escalation actions with a banner; wire SSE auto-refresh for failures and add toast notifications.

**Architecture:** Pure frontend changes (except simulator script). `ScriptDiffPanel` merges suggestions client-side using the `diff` package and renders a unified diff inline in the existing script editor section. `ToastContainer` is mounted once in `App.vue` and driven by a `useToast` composable. Escalation banner in `AgentDetail` reads localStorage on mount to count unhandled escalations.

**Tech Stack:** Vue 3 / `<script setup>` / Pinia, `diff` npm package (diffLines), localStorage/sessionStorage for handled state, existing CSS variables (`--fail`, `--pass`, `--warn`, `--accent`, etc.)

---

## File Map

| Action | File |
|---|---|
| Modify | `voice-ai-copilot/backend/src/scripts/simulate-webhook.ts` |
| Modify | `voice-ai-copilot/frontend/package.json` |
| Create | `voice-ai-copilot/frontend/src/composables/useToast.ts` |
| Create | `voice-ai-copilot/frontend/src/components/ToastContainer.vue` |
| Modify | `voice-ai-copilot/frontend/src/App.vue` |
| Create | `voice-ai-copilot/frontend/src/components/ScriptDiffPanel.vue` |
| Modify | `voice-ai-copilot/frontend/src/components/UseActionBadge.vue` |
| Modify | `voice-ai-copilot/frontend/src/views/AgentDetail.vue` |

---

## Task 1: Add `diff` package to frontend

**Files:**
- Modify: `voice-ai-copilot/frontend/package.json`

- [ ] **Step 1: Add diff and its types to frontend dependencies**

In `voice-ai-copilot/frontend/package.json`, add to `"dependencies"`:
```json
"diff": "^5.2.0"
```
Add to `"devDependencies"`:
```json
"@types/diff": "^5.2.1"
```

- [ ] **Step 2: Install**

```bash
cd voice-ai-copilot/frontend
npm install
```

Expected: `diff` and `@types/diff` appear in `node_modules`.

- [ ] **Step 3: Verify import works**

```bash
cd voice-ai-copilot/frontend
node -e "const d = require('diff'); console.log(typeof d.diffLines)"
```

Expected output: `function`

- [ ] **Step 4: Commit**

```bash
git add voice-ai-copilot/frontend/package.json voice-ai-copilot/frontend/package-lock.json
git commit -m "chore: add diff package to frontend for script diff panel"
```

---

## Task 2: Add 6 rich simulation test cases

**Files:**
- Modify: `voice-ai-copilot/backend/src/scripts/simulate-webhook.ts`

Each new case is crafted to reliably trigger specific `useAction` types and `scriptSuggestions` from the LLM.

- [ ] **Step 1: Add 2 new cases to agent-alpha array**

In `simulate-webhook.ts`, find the `agent-alpha` array (currently 4 cases ending with the PARTIAL Aetna case). Append these two cases before the closing `],` of the `agent-alpha` array:

```typescript
    {
      label: 'PARTIAL — Appointment booked but insurance never qualified (missed opportunity)',
      outcome: 'partial',
      turns: [
        { speaker: 'agent', text: "Hi, this is Sarah from Sunrise Dental. Am I speaking with Rachel?", timestamp_ms: 0 },
        { speaker: 'user',  text: "Yes, that's me.", timestamp_ms: 2100 },
        { speaker: 'agent', text: "Hi Rachel! I'm calling about our new patient special — a comprehensive exam, X-rays, and cleaning for $99. We'd love to get you scheduled.", timestamp_ms: 3500 },
        { speaker: 'user',  text: "Oh that sounds good, I've been putting off going to the dentist.", timestamp_ms: 9200 },
        { speaker: 'agent', text: "We have availability on Monday at 11 AM or Wednesday at 2 PM — which works better for you?", timestamp_ms: 11000 },
        { speaker: 'user',  text: "Monday at 11 works great.", timestamp_ms: 15800 },
        { speaker: 'agent', text: "Perfect! You're booked for Monday at 11 AM. We'll send a confirmation text. Is this the best number?", timestamp_ms: 17400 },
        { speaker: 'user',  text: "Yes, that's fine.", timestamp_ms: 22100 },
        { speaker: 'agent', text: "Great, see you Monday!", timestamp_ms: 23600 },
      ],
    },
    {
      label: 'FAIL — Patient becomes aggressive and threatening, escalation required',
      outcome: 'fail',
      turns: [
        { speaker: 'agent', text: "Hi, calling from Sunrise Dental about our new patient offer.", timestamp_ms: 0 },
        { speaker: 'user',  text: "Why do you keep calling me? I've told you people to stop!", timestamp_ms: 2400 },
        { speaker: 'agent', text: "I apologize for the inconvenience. I just wanted to share our $99 new patient special.", timestamp_ms: 4200 },
        { speaker: 'user',  text: "I don't care about your special. If you call me again I'm reporting you to the FTC and I'll sue your company. Stop calling!", timestamp_ms: 7100 },
        { speaker: 'agent', text: "I understand you're upset. Let me just explain the offer quickly—", timestamp_ms: 13600 },
        { speaker: 'user',  text: "Are you serious right now? I just said I'm going to sue you and you're still pitching me? This is harassment!", timestamp_ms: 16200 },
        { speaker: 'agent', text: "I'll note your preference. Have a good day.", timestamp_ms: 21900 },
      ],
    },
```

- [ ] **Step 2: Add 2 new cases to agent-beta array**

Find the `agent-beta` array (3 cases). Append before its closing `],`:

```typescript
    {
      label: 'PARTIAL — Agent promises non-existent commission waiver (script deviation)',
      outcome: 'partial',
      turns: [
        { speaker: 'agent', text: "Hi, Marcus from Summit Real Estate. You filled out a form about properties — do you have a minute?", timestamp_ms: 0 },
        { speaker: 'user',  text: "Sure, yeah.", timestamp_ms: 3200 },
        { speaker: 'agent', text: "Great. What's your target budget range?", timestamp_ms: 4800 },
        { speaker: 'user',  text: "Around $500K to $600K, but I'm worried about agent commissions on top of that.", timestamp_ms: 9500 },
        { speaker: 'agent', text: "Actually, for buyers in your range we're currently waiving our buyer's commission entirely — so there's no cost to you at all.", timestamp_ms: 13200 },
        { speaker: 'user',  text: "Oh wow, really? That's great, I didn't know that was possible.", timestamp_ms: 19100 },
        { speaker: 'agent', text: "Absolutely. So with that off the table, would you like to set up a call with one of our buyer specialists this week?", timestamp_ms: 21800 },
        { speaker: 'user',  text: "Sure, that sounds good.", timestamp_ms: 27400 },
        { speaker: 'agent', text: "Perfect, I'll get that scheduled. What's the best email for a calendar invite?", timestamp_ms: 29100 },
        { speaker: 'user',  text: "It's sarah@email.com.", timestamp_ms: 33500 },
      ],
    },
    {
      label: 'FAIL — Buyer requests legal and title advice, agent cannot handle, escalation needed',
      outcome: 'fail',
      turns: [
        { speaker: 'agent', text: "Hi, Marcus from Summit Real Estate. You submitted a form about homes in the area.", timestamp_ms: 0 },
        { speaker: 'user',  text: "Yes, I was looking. But honestly my main concern is the title situation on a property I'm considering. There may be a lien on it.", timestamp_ms: 4100 },
        { speaker: 'agent', text: "I see. A lien can sometimes be resolved at closing.", timestamp_ms: 10800 },
        { speaker: 'user',  text: "Can you tell me what my legal exposure is if the lien isn't cleared before we close? And what happens to my deposit?", timestamp_ms: 14200 },
        { speaker: 'agent', text: "That's a good question. Generally speaking, liens transfer with the property unless resolved.", timestamp_ms: 22100 },
        { speaker: 'user',  text: "So I could be responsible for someone else's debt? I need specific legal advice here, not generalizations.", timestamp_ms: 27600 },
        { speaker: 'agent', text: "I'd recommend consulting a real estate attorney for that level of detail.", timestamp_ms: 34500 },
        { speaker: 'user',  text: "Then what am I talking to you for? This isn't helpful.", timestamp_ms: 38900 },
        { speaker: 'agent', text: "I understand. I'll note your concerns.", timestamp_ms: 41200 },
      ],
    },
```

- [ ] **Step 3: Add 2 new cases to agent-gamma array**

Find the `agent-gamma` array (4 cases). Append before its closing `],`:

```typescript
    {
      label: 'PARTIAL — Agent promises non-existent feature (script deviation)',
      outcome: 'partial',
      turns: [
        { speaker: 'agent', text: "Hi Kevin, Alex from TechPro Solutions. You looked at our platform a while back — do you have a couple minutes?", timestamp_ms: 0 },
        { speaker: 'user',  text: "Sure. We're still evaluating tools.", timestamp_ms: 4200 },
        { speaker: 'agent', text: "What's been the biggest gap with what you've tried so far?", timestamp_ms: 6100 },
        { speaker: 'user',  text: "We really need native Salesforce integration — bidirectional sync, not just a Zapier workaround.", timestamp_ms: 10800 },
        { speaker: 'agent', text: "Yes, we have a native Salesforce connector that does full bidirectional sync. It's been available since our last release.", timestamp_ms: 17300 },
        { speaker: 'user',  text: "Oh perfect, that's exactly what we need. Does it support custom objects?", timestamp_ms: 23600 },
        { speaker: 'agent', text: "It handles standard objects out of the box and custom objects can be configured in the settings.", timestamp_ms: 27200 },
        { speaker: 'user',  text: "Great, that changes things. Can we set up a demo to see it in action?", timestamp_ms: 33900 },
        { speaker: 'agent', text: "Absolutely! I have Thursday at 2 or Friday at 10 — which works?", timestamp_ms: 36500 },
        { speaker: 'user',  text: "Thursday at 2 works.", timestamp_ms: 40100 },
        { speaker: 'agent', text: "Perfect, I'll send the invite!", timestamp_ms: 41800 },
      ],
    },
    {
      label: 'FAIL — Prospect raises SOC2 compliance concern, agent cannot answer, escalation needed',
      outcome: 'fail',
      turns: [
        { speaker: 'agent', text: "Hi Maria, Alex from TechPro Solutions. You submitted interest in our workflow platform.", timestamp_ms: 0 },
        { speaker: 'user',  text: "Right. We were looking at it but our security team flagged some concerns.", timestamp_ms: 4700 },
        { speaker: 'agent', text: "Happy to address those. What were their concerns?", timestamp_ms: 7900 },
        { speaker: 'user',  text: "We're SOC2 Type II certified and need all our vendors to be as well. Are you SOC2 Type II certified?", timestamp_ms: 12100 },
        { speaker: 'agent', text: "We take security very seriously and have robust data protection measures in place.", timestamp_ms: 18500 },
        { speaker: 'user',  text: "That's not what I asked. SOC2 Type II is a specific certification. Do you have it or not?", timestamp_ms: 23100 },
        { speaker: 'agent', text: "I believe we have various compliance certifications. I'd have to check on the specific SOC2 details.", timestamp_ms: 28700 },
        { speaker: 'user',  text: "This is a hard requirement for us. If you can't confirm it right now, this conversation is over.", timestamp_ms: 34200 },
        { speaker: 'agent', text: "I understand. I can have someone follow up with the documentation.", timestamp_ms: 39800 },
        { speaker: 'user',  text: "Fine. But we won't proceed without it.", timestamp_ms: 43600 },
      ],
    },
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd voice-ai-copilot/backend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add voice-ai-copilot/backend/src/scripts/simulate-webhook.ts
git commit -m "feat: add 6 rich simulation cases with deviations and escalations"
```

---

## Task 3: Create `useToast` composable

**Files:**
- Create: `voice-ai-copilot/frontend/src/composables/useToast.ts`

- [ ] **Step 1: Create the composable**

Create `voice-ai-copilot/frontend/src/composables/useToast.ts`:

```typescript
import { ref } from 'vue'

export interface Toast {
  id: number
  message: string
  type: 'success' | 'error'
}

let nextId = 0
const toasts = ref<Toast[]>([])

export function useToast() {
  function add(message: string, type: Toast['type'] = 'success', durationMs = 4000) {
    const id = ++nextId
    toasts.value.push({ id, message, type })
    setTimeout(() => remove(id), durationMs)
  }

  function remove(id: number) {
    const idx = toasts.value.findIndex((t) => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }

  return { toasts, add, remove }
}
```

Note: `toasts` is module-level (singleton) so all callers share the same list — `App.vue` adds, `ToastContainer.vue` reads.

- [ ] **Step 2: Commit**

```bash
git add voice-ai-copilot/frontend/src/composables/useToast.ts
git commit -m "feat: add useToast composable for SSE event notifications"
```

---

## Task 4: Create `ToastContainer.vue`

**Files:**
- Create: `voice-ai-copilot/frontend/src/components/ToastContainer.vue`

- [ ] **Step 1: Create the component**

Create `voice-ai-copilot/frontend/src/components/ToastContainer.vue`:

```vue
<template>
  <Teleport to="body">
    <div class="toast-container" aria-live="polite">
      <TransitionGroup name="toast" tag="div" class="toast-stack">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast"
          :class="toast.type"
          @click="remove(toast.id)"
        >
          <span class="toast-dot" />
          <span class="toast-msg">{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast } from '../composables/useToast'

const { toasts, remove } = useToast()
</script>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  pointer-events: none;
}

.toast-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-left-width: 3px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  pointer-events: all;
  cursor: pointer;
  min-width: 220px;
  max-width: 340px;
}

.toast.success { border-left-color: var(--pass); }
.toast.error   { border-left-color: var(--fail); }

.toast-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.toast.success .toast-dot { background: var(--pass); }
.toast.error   .toast-dot { background: var(--fail); }

/* TransitionGroup animations */
.toast-enter-active { transition: all 250ms ease; }
.toast-leave-active { transition: all 200ms ease; }
.toast-enter-from   { opacity: 0; transform: translateX(20px); }
.toast-leave-to     { opacity: 0; transform: translateX(20px); }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add voice-ai-copilot/frontend/src/components/ToastContainer.vue
git commit -m "feat: add ToastContainer component for SSE notifications"
```

---

## Task 5: Wire SSE events and toast in `App.vue`

**Files:**
- Modify: `voice-ai-copilot/frontend/src/App.vue`

- [ ] **Step 1: Replace App.vue**

Replace the entire content of `voice-ai-copilot/frontend/src/App.vue`:

```vue
<template>
  <div class="app-shell" :data-theme="theme">
    <AppSidebar :locationId="locationId" :theme="theme" @toggle-theme="toggleTheme" />
    <main class="app-main">
      <RouterView :locationId="locationId" />
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
import { useSSE } from './composables/useSSE'
import { useToast } from './composables/useToast'

const locationId = new URLSearchParams(window.location.search).get('locationId') ?? 'demo-location-001'

const streamStore  = useStreamStore()
const agentsStore  = useAgentsStore()
const analysisStore = useAnalysisStore()
const { add: addToast } = useToast()

const { connected } = useSSE(locationId, (event) => {
  streamStore.setConnected(true)

  if (event.type === 'analysis.complete' && event.agentId) {
    agentsStore.fetchAll(locationId)
    analysisStore.fetchResults(event.agentId, locationId)
    addToast('Analysis complete', 'success')
  }

  if (event.type === 'analysis.failed' && event.agentId) {
    analysisStore.fetchResults(event.agentId, locationId)
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
```

- [ ] **Step 2: Verify frontend compiles**

```bash
cd voice-ai-copilot/frontend
npm run build 2>&1 | tail -20
```

Expected: `built in` with no errors.

- [ ] **Step 3: Commit**

```bash
git add voice-ai-copilot/frontend/src/App.vue
git commit -m "feat: wire SSE toast notifications and analysis.failed refresh in App.vue"
```

---

## Task 6: Create `ScriptDiffPanel.vue`

**Files:**
- Create: `voice-ai-copilot/frontend/src/components/ScriptDiffPanel.vue`

- [ ] **Step 1: Create the component**

Create `voice-ai-copilot/frontend/src/components/ScriptDiffPanel.vue`:

```vue
<template>
  <div class="diff-panel">
    <div class="diff-header">
      <div class="diff-title-row">
        <span class="diff-title">Suggested Script Changes</span>
        <span class="diff-count mono">{{ suggestions.length }} suggestion{{ suggestions.length !== 1 ? 's' : '' }}</span>
      </div>
      <div class="diff-actions">
        <button class="dismiss-btn" @click="$emit('dismiss')">Dismiss</button>
        <button class="save-btn" :disabled="saving" @click="handleSave">
          <svg v-if="saving" width="11" height="11" viewBox="0 0 12 12" fill="none" class="spin">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="14" stroke-dashoffset="4"/>
          </svg>
          {{ saving ? 'Saving…' : 'Save to Script' }}
        </button>
      </div>
    </div>

    <div class="diff-legend">
      <span class="legend-item removed-legend">− Removed</span>
      <span class="legend-item added-legend">+ Added</span>
    </div>

    <div class="diff-body">
      <div
        v-for="(chunk, i) in diffChunks"
        :key="i"
        class="diff-line"
        :class="{
          'diff-removed': chunk.removed,
          'diff-added': chunk.added,
        }"
      >
        <span class="diff-gutter">{{ chunk.removed ? '−' : chunk.added ? '+' : ' ' }}</span>
        <span class="diff-text">{{ chunk.value }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { diffLines } from 'diff'
import type { ScriptSuggestion } from '../types/analysis.types'

const props = defineProps<{
  currentScript: string
  suggestions: ScriptSuggestion[]
}>()

const emit = defineEmits<{
  save: [newScript: string]
  dismiss: []
}>()

const saving = ref(false)

// Apply all suggestions to produce the merged script
const suggestedScript = computed((): string => {
  let merged = props.currentScript
  for (const s of props.suggestions) {
    if (s.currentApproach && merged.includes(s.currentApproach)) {
      merged = merged.replace(s.currentApproach, s.suggestedScript)
    } else {
      merged += `\n\n## ${s.sectionTitle} — Suggested Addition\n${s.suggestedScript}`
    }
  }
  return merged
})

// Line-level diff chunks between current and suggested
const diffChunks = computed(() => {
  return diffLines(props.currentScript, suggestedScript.value)
    .flatMap((chunk) => {
      // Split multi-line chunks into individual lines so each gets its own row
      const lines = chunk.value.split('\n')
      // Remove trailing empty string from trailing newline split
      if (lines[lines.length - 1] === '') lines.pop()
      return lines.map((line) => ({
        value: line,
        added: chunk.added ?? false,
        removed: chunk.removed ?? false,
      }))
    })
})

async function handleSave() {
  saving.value = true
  try {
    emit('save', suggestedScript.value)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.diff-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-surface);
}

.diff-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}

.diff-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.diff-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-2);
}

.diff-count {
  font-size: 10.5px;
  color: var(--accent);
  background: rgba(79, 136, 255, 0.1);
  border: 1px solid rgba(79, 136, 255, 0.2);
  padding: 1px 8px;
  border-radius: 99px;
}

.diff-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dismiss-btn {
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-sans);
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 6px 14px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--t-fast);
}

.dismiss-btn:hover {
  background: var(--bg-hover);
  color: var(--text-2);
}

.save-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-sans);
  background: var(--accent);
  border: none;
  border-radius: var(--radius-sm);
  padding: 6px 14px;
  color: #fff;
  cursor: pointer;
  transition: opacity var(--t-fast);
}

.save-btn:hover:not(:disabled) { opacity: 0.88; }
.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.diff-legend {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 16px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-card);
}

.legend-item {
  font-size: 11px;
  font-family: var(--font-mono);
  font-weight: 600;
}

.removed-legend { color: #dc2626; }
.added-legend   { color: #16a34a; }

.diff-body {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  overflow-y: auto;
  max-height: 420px;
}

.diff-line {
  display: flex;
  align-items: flex-start;
  gap: 0;
  padding: 0;
}

.diff-removed {
  background: rgba(220, 38, 38, 0.08);
}

.diff-added {
  background: rgba(22, 163, 74, 0.08);
}

.diff-gutter {
  width: 28px;
  min-width: 28px;
  text-align: center;
  padding: 1px 0;
  color: var(--text-muted);
  user-select: none;
  flex-shrink: 0;
}

.diff-removed .diff-gutter { color: #dc2626; }
.diff-added   .diff-gutter { color: #16a34a; }

.diff-text {
  flex: 1;
  padding: 1px 10px 1px 0;
  color: var(--text-2);
  white-space: pre-wrap;
  word-break: break-word;
}

.diff-removed .diff-text { color: #dc2626; }
.diff-added   .diff-text { color: #16a34a; }

.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
```

- [ ] **Step 2: Verify no type errors**

```bash
cd voice-ai-copilot/frontend
npm run build 2>&1 | tail -20
```

Expected: builds successfully, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add voice-ai-copilot/frontend/src/components/ScriptDiffPanel.vue
git commit -m "feat: add ScriptDiffPanel component with client-side diff merge"
```

---

## Task 7: Update `UseActionBadge.vue` for escalation "Mark as handled"

**Files:**
- Modify: `voice-ai-copilot/frontend/src/components/UseActionBadge.vue`

The escalation_needed CSS styling already exists. The only change needed is relabeling the review button for escalation types and using a separate localStorage key so the AgentDetail banner can query handled escalations independently.

- [ ] **Step 1: Replace the review button label logic and add escalation-specific localStorage key**

In `UseActionBadge.vue`, replace the `<script setup>` section (lines 67–132):

```vue
<script setup lang="ts">
import { computed, ref, nextTick, onMounted } from 'vue'

const props = defineProps<{
  type: 'missed_opportunity' | 'deviation' | 'escalation_needed'
  description: string
  turnIndex?: number | null
  actionId?: string | null
}>()

// ── localStorage keys ──────────────────────────────────────
// escalation_needed uses a separate key so AgentDetail can query it independently
const isEscalation = computed(() => props.type === 'escalation_needed')
const keyReviewed  = computed(() => {
  if (!props.actionId) return null
  return isEscalation.value
    ? `ua-escalation-handled-${props.actionId}`
    : `ua-reviewed-${props.actionId}`
})
const keyNote = computed(() => props.actionId ? `ua-note-${props.actionId}` : null)

// ── State ──────────────────────────────────────────────────
const reviewed = ref(false)
const note     = ref('')
const noteOpen = ref(false)
const noteRef  = ref<HTMLTextAreaElement | null>(null)

onMounted(() => {
  if (keyReviewed.value) reviewed.value = localStorage.getItem(keyReviewed.value) === 'true'
  if (keyNote.value)     note.value     = localStorage.getItem(keyNote.value) ?? ''
})

// ── Actions ────────────────────────────────────────────────
function toggleReviewed() {
  reviewed.value = !reviewed.value
  if (keyReviewed.value) localStorage.setItem(keyReviewed.value, String(reviewed.value))
}

async function openNote() {
  noteOpen.value = true
  await nextTick()
  noteRef.value?.focus()
}

function saveNote() {
  if (keyNote.value) localStorage.setItem(keyNote.value, note.value)
}

function clearNote() {
  note.value = ''
  saveNote()
  noteOpen.value = false
}

// ── Label maps ─────────────────────────────────────────────
const typeLabel = computed(() => ({
  missed_opportunity: 'Missed Opportunity',
  deviation:          'Script Deviation',
  escalation_needed:  'Escalation Needed',
}[props.type]))

const typeIcon = computed(() => ({
  missed_opportunity: '◈',
  deviation:          '△',
  escalation_needed:  '⚠',
}[props.type]))

const typeMeaning = computed(() => ({
  missed_opportunity: 'Agent could have acted but didn\'t — coaching opportunity',
  deviation:          'Agent deviated from the expected script or process',
  escalation_needed:  'This segment requires human review or intervention',
}[props.type]))

// ── Review button labels (differ for escalation type) ──────
const reviewBtnLabel    = computed(() => isEscalation.value ? 'Mark as handled' : 'Review')
const reviewedBtnLabel  = computed(() => isEscalation.value ? 'Handled ✓' : 'Reviewed')
</script>
```

- [ ] **Step 2: Update the review button template to use dynamic labels**

In `UseActionBadge.vue`, replace the `<button class="review-btn"...>` block (lines 15–28) in the template:

```vue
      <button
        class="review-btn"
        :class="{ reviewed }"
        @click="toggleReviewed"
        :title="reviewed ? (isEscalation ? 'Mark as unhandled' : 'Mark as pending') : (isEscalation ? 'Mark as handled — remove from escalation banner' : 'Mark as reviewed')"
      >
        <svg v-if="reviewed" width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M1.5 5.5l3 3 5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <svg v-else width="11" height="11" viewBox="0 0 11 11" fill="none">
          <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" stroke-width="1.3"/>
        </svg>
        <span>{{ reviewed ? reviewedBtnLabel : reviewBtnLabel }}</span>
      </button>
```

- [ ] **Step 3: Verify build**

```bash
cd voice-ai-copilot/frontend
npm run build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add voice-ai-copilot/frontend/src/components/UseActionBadge.vue
git commit -m "feat: add 'Mark as handled' label for escalation_needed use action badges"
```

---

## Task 8: Wire ScriptDiffPanel and escalation banner in `AgentDetail.vue`

**Files:**
- Modify: `voice-ai-copilot/frontend/src/views/AgentDetail.vue`

This is the largest task. Make changes in three separate steps to keep each diff small.

- [ ] **Step 1: Add imports and new reactive state to the `<script setup>` block**

In `AgentDetail.vue`, replace the imports block (lines 284–297) and add new state after the existing state declarations:

```vue
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
```

Then add these new state variables after `const reanalyzeDone = ref<Set<string>>(new Set())` (after line 322):

```typescript
// Script diff panel state
const diffPanelOpen = ref(false)

// Escalation banner state
const bannerDismissed = ref(false)
```

- [ ] **Step 2: Add computed properties for allSuggestions and unhandledEscalations**

Add these computed properties after the `agentHealth` computed (after line 360):

```typescript
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
      if (ua.type === 'escalation_needed' && ua.id) {
        const handled = localStorage.getItem(`ua-escalation-handled-${ua.id}`) === 'true'
        if (!handled) count++
      }
    }
  }
  return count
})
```

- [ ] **Step 3: Add helper functions for diff panel and escalation banner**

Add these functions after the `reanalyze` function (after line 412):

```typescript
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
```

Also add this line inside `onMounted`, after `loading.value = false` in the finally block:

```typescript
bannerDismissed.value = sessionStorage.getItem(`escalation-banner-dismissed-${id}`) === '1'
```

The updated `onMounted` finally block becomes:
```typescript
  } finally {
    loading.value = false
    bannerDismissed.value = sessionStorage.getItem(`escalation-banner-dismissed-${id}`) === '1'
  }
```

- [ ] **Step 4: Add escalation banner to the template**

In the template, add the escalation banner immediately after the `<header class="page-header">` closing tag (after line 34) and before the `<!-- Script editor -->` comment:

```vue
      <!-- Escalation banner -->
      <div
        v-if="unhandledEscalationCount > 0 && !bannerDismissed"
        class="escalation-banner"
      >
        <span class="escalation-banner-icon">⚠</span>
        <span class="escalation-banner-text">
          {{ unhandledEscalationCount }} unhandled escalation{{ unhandledEscalationCount !== 1 ? 's' : '' }} require human review
        </span>
        <button class="escalation-banner-dismiss" @click="dismissEscalationBanner" title="Dismiss for this session">✕</button>
      </div>
```

- [ ] **Step 5: Add "View Suggested Changes" button and ScriptDiffPanel to the script editor section**

In the template, find the `<div v-if="scriptOpen" class="script-body">` block. Replace the `<div class="script-footer">` block (lines 67–75) with:

```vue
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
```

- [ ] **Step 6: Add CSS for the new elements**

At the end of the `<style scoped>` section (before the final `</style>`), add:

```css
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
```

- [ ] **Step 7: Verify full build**

```bash
cd voice-ai-copilot/frontend
npm run build 2>&1 | tail -20
```

Expected: no TypeScript or Vite errors.

- [ ] **Step 8: Commit**

```bash
git add voice-ai-copilot/frontend/src/views/AgentDetail.vue
git commit -m "feat: add script diff panel and escalation banner to AgentDetail"
```

---

## Task 9: Update CHANGELOG

- [ ] **Step 1: Check if CHANGELOG.md exists**

```bash
ls voice-ai-copilot/CHANGELOG.md 2>/dev/null || echo "not found"
```

- [ ] **Step 2: Create or update CHANGELOG.md**

If `voice-ai-copilot/CHANGELOG.md` does not exist, create it:

```markdown
# Changelog

All notable changes to the Voice AI Observability Copilot are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

## [Unreleased]

### Added
- Six new simulator test cases with script deviations and escalation scenarios so simulation covers missed opportunities, false promises, compliance blockers, and threatening callers across all three agents
- Inline script diff panel in the agent script editor so managers can review LLM-suggested script changes with red/green line highlighting before saving
- "Mark as handled" button on escalation_needed use action badges, using a dedicated localStorage key so handled state is tracked separately from regular reviewed state
- Escalation banner at the top of the agent detail page that counts unhandled escalations and is dismissible per session
- Toast notifications for analysis.complete and analysis.failed SSE events so users get immediate visual feedback when Temporal analysis finishes
- analysis.failed SSE events now trigger a data refresh so the failed status pill appears without a page reload
```

If it already exists, prepend the `### Added` entries above to the existing `## [Unreleased]` block.

- [ ] **Step 3: Commit**

```bash
git add voice-ai-copilot/CHANGELOG.md
git commit -m "chore: update changelog for rich simulation, script diff, escalation, and SSE toast"
```

---

## Self-Review

**Spec coverage check:**
- [x] 6 new simulator cases (2 per agent: missed_opportunity, deviation, escalation) — Task 2
- [x] ScriptDiffPanel with client-side merge and diffLines — Task 6
- [x] "View Suggested Changes" button in script editor — Task 8 Step 5
- [x] Save merged script via existing PUT endpoint — Task 8 Step 3 (`handleDiffSave`)
- [x] Dismiss diff panel — Task 8 Step 5 (`@dismiss="diffPanelOpen = false"`)
- [x] allSuggestions flattened from all transcript cards, deduped by sectionTitle+issue — Task 8 Step 2
- [x] Escalation banner with count and session dismiss — Task 8 Steps 4 & 3
- [x] UseActionBadge "Mark as handled" label + `ua-escalation-handled-{id}` key — Task 7
- [x] SSE toast on analysis.complete and analysis.failed — Task 5
- [x] analysis.failed triggers fetchResults — Task 5
- [x] ToastContainer mounted in App.vue — Task 5
- [x] useToast singleton composable — Task 3
- [x] diff package installed — Task 1
- [x] CHANGELOG updated — Task 9

**Placeholder scan:** No TBDs, no "similar to above", all code blocks are complete.

**Type consistency:**
- `ScriptSuggestion` imported in AgentDetail from `analysis.types` — matches the type used in ScriptDiffPanel props ✓
- `allSuggestions` is `ScriptSuggestion[]` — matches `ScriptDiffPanel` prop type `suggestions: ScriptSuggestion[]` ✓
- `handleDiffSave(newScript: string)` — matches `ScriptDiffPanel` emit `save: [newScript: string]` ✓
- `useToast().add(message, type)` in App.vue — matches `add(message: string, type: Toast['type'])` signature in composable ✓
- `ua-escalation-handled-${ua.id}` in AgentDetail computed matches key written by UseActionBadge (`ua-escalation-handled-${props.actionId}`) ✓
