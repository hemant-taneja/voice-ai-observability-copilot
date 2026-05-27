# Design: Rich Simulation Cases, Script Diff UI, Escalation Handling & SSE Toast

**Date:** 2026-05-26
**Status:** Approved
**Risk:** Low — pure frontend + simulator script changes, no DB/route/LLM changes

---

## 1. Rich Simulation Test Cases

Add 6 new scenarios to `backend/src/scripts/simulate-webhook.ts` (total 11 → 17 cases).

Each new case is crafted to reliably trigger `useActions` and/or `scriptSuggestions` from the LLM.

### agent-alpha — Sunrise Dental Booker
| Label | Outcome | Triggers |
|---|---|---|
| Appointment booked but insurance never asked | partial | `missed_opportunity` on insurance step + `scriptSuggestion` for qualification section |
| Patient becomes aggressive/threatening | fail | `escalation_needed` — agent cannot de-escalate alone |

### agent-beta — Summit RE Qualifier
| Label | Outcome | Triggers |
|---|---|---|
| Agent quotes non-existent commission waiver | partial | `deviation` use action + `scriptSuggestion` correcting the false promise |
| Buyer requests legal/title advice | fail | `escalation_needed` — must hand off to licensed agent |

### agent-gamma — TechPro Re-Engagement
| Label | Outcome | Triggers |
|---|---|---|
| Agent promises feature that does not exist | partial | `deviation` use action + `scriptSuggestion` replacing the false promise with accurate messaging |
| Prospect raises SOC2/data residency compliance concern | fail | `escalation_needed` — requires security team involvement |

---

## 2. Script Diff UI

### Location
Inside the existing **script editor section** of `AgentDetail.vue`. No new route or page.

### Trigger
When `allSuggestions` (flattened `scriptSuggestions` from `latestAnalysis(tc)` across all transcript cards) is non-empty, a button **"View Suggested Changes (N)"** appears above the script textarea.

### New Component: `ScriptDiffPanel.vue`
**Props:** `currentScript: string`, `suggestions: ScriptSuggestion[]`
**Emits:** `save(newScript: string)`, `dismiss()`

**Merge logic (client-side):**
1. Start with `merged = currentScript`
2. For each suggestion: find `suggestion.currentApproach` as a substring of `merged` → replace with `suggestion.suggestedScript`
3. If not found verbatim: append `\n\n## [sectionTitle] — Suggested Addition\n${suggestedScript}` to end of `merged`
4. Run `diffLines(currentScript, merged)` from the `diff` npm package

**Render:**
- Two-column layout: left = current script, right = suggested script
- Removed lines highlighted red (`background: #ffeef0`), added lines highlighted green (`background: #e6ffed`)
- Unchanged lines rendered normally
- **"Save to Script"** button: calls existing `PUT /api/agents/:agentId` with `merged`, closes panel
- **"Dismiss"** button: closes panel without saving

### Dependency
Add `diff` to `frontend/package.json` (already present in `node_modules` via backend — add explicitly to frontend).

---

## 3. Escalation Handling

### UseActionBadge.vue updates
- `escalation_needed` type gets: red left border (`border-left: 3px solid #dc2626`), red label text
- New **"Mark as handled"** button on escalation badges
- Handled state persisted: `localStorage.setItem('ua-escalation-handled-${actionId}', '1')`
- When handled: badge switches to gray, label becomes "Handled ✓", button hidden

### Escalation Banner
A dismissible red alert strip at the **top of the agent detail page**, shown when at least one unhandled `escalation_needed` action exists across all current transcript cards.

- Text: "N unhandled escalation(s) require human review"
- Dismiss persisted to `sessionStorage` keyed by `escalation-banner-dismissed-${agentId}`
- Recomputed reactively — disappears automatically when all escalations are marked handled

---

## 4. SSE Auto-refresh + Toast

### Auto-refresh fixes
- `analysis.failed` events (currently ignored in `App.vue`) now trigger `analysisStore.fetchResults(agentId, locationId)` so the failed status pill appears without a page reload
- `AgentDetail.vue` reads reactively from the Pinia store — no additional wiring needed

### New: `useToast.ts` composable
```ts
interface Toast { id: number; message: string; type: 'success' | 'error' }
// add(message, type) — pushes toast, auto-removes after 4000ms
// toasts — readonly ref<Toast[]>
```

### New: `ToastContainer.vue`
- Fixed bottom-right, `z-index: 9999`
- Each toast: small pill, colored left border (green = success, red = error), fade-in/out transition
- Mounted once in `App.vue`

### SSE wiring in `App.vue`
```
analysis.complete → green toast "Analysis complete" + agentsStore.fetchAll + analysisStore.fetchResults
analysis.failed   → red toast "Analysis failed — check transcript" + analysisStore.fetchResults
```

---

## 5. Files Touched

| File | Change |
|---|---|
| `backend/src/scripts/simulate-webhook.ts` | +6 test cases |
| `frontend/src/components/ScriptDiffPanel.vue` | New |
| `frontend/src/components/ToastContainer.vue` | New |
| `frontend/src/components/UseActionBadge.vue` | Escalation styling + Mark as handled |
| `frontend/src/views/AgentDetail.vue` | Wire ScriptDiffPanel + EscalationBanner |
| `frontend/src/App.vue` | SSE toast wiring + analysis.failed handling |
| `frontend/src/composables/useToast.ts` | New |
| `frontend/package.json` | Add `diff` dependency |

---

## 6. Out of Scope

- Backend changes to track escalation handled state (localStorage is sufficient, consistent with existing UseAction reviewed pattern)
- Per-suggestion apply/reject (all suggestions applied together)
- LLM prompt changes (existing prompt already requests all required fields)
