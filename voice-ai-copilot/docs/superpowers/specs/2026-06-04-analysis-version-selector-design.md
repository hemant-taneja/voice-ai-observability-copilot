# Analysis Version Selector — Design

**Date:** 2026-06-04
**Status:** Approved (design), pending spec review
**Scope:** Frontend only (`voice-ai-copilot/frontend`)

## Problem

A single transcript can have multiple analysis runs (the original analysis plus
any re-analyses triggered from the drawer). The backend already returns **all**
of them: `GET /api/agents/:agentId/analysis` aggregates analyses per transcript,
sorted newest-first (`agents-service.ts` — `json_agg(... ORDER BY ar.analyzed_at DESC)`),
and the frontend type models this as `TranscriptCard.analyses: AnalysisVersion[]`.

However, the UI collapses that array to a single element everywhere via
`latestAnalysis(tc) => tc.analyses[0]` (`AgentDetail.vue`). Older versions are
fetched over the wire and then silently discarded — there is no way to view them.

## Goal

Let the user view any analysis version for a transcript, selectable from a
dropdown in the detail drawer, without changing the backend or data model.

## Non-goals (YAGNI)

- No side-by-side version diff / comparison.
- No persistence of the selected version (ephemeral UI state only).
- No changes to the backend, API, DB, or the `analyses[]` contract.
- No version selection on the Dashboard — this is scoped to `AgentDetail.vue`.

## Behavior

### Detail drawer
- Add a version dropdown in the drawer header.
- Labels use **version numbers, newest = highest**: `v{n} (latest)`, `v{n-1}`, … `v1`.
  Since `analyses` is sorted newest-first, dropdown index `0` = `v{n}` (latest),
  index `1` = `v{n-1}`, etc. The displayed version number for index `i` is
  `analyses.length - i`.
- The dropdown only appears when the transcript has analyses (`analyses.length >= 1`).
  With a single analysis it still shows `v1 (latest)` (harmless, consistent).
- Selecting a version re-renders the drawer body for **that** version: score, result
  chip, KPI scores, summary, use-actions, and the transcript highlights
  (`TranscriptViewer :useActions`).
- Default selection = latest (index `0`) every time a transcript's drawer opens.

### Table row
- Show a subtle `v{n}` badge next to the score **only when** `analyses.length > 1`.
- The row's score / result / use-action counts continue to reflect the **latest**
  version (index 0). The badge is purely an affordance signalling "this transcript
  has re-analyses worth opening".

## Implementation (Approach A — inline)

All changes are within `frontend/src/views/AgentDetail.vue`. No new components,
no store changes. Chosen for the smallest, lowest-risk diff, consistent with the
existing pattern where the entire drawer already lives in this file.

### New reactive state
```ts
const selectedVersionIndex = ref(0) // 0 = latest; index into drawerCard.analyses
```

### New computed
```ts
const selectedAnalysis = computed<AnalysisVersion | null>(
  () => drawerCard.value?.analyses[selectedVersionIndex.value] ?? null
)
```

### Wiring changes
- `openDrawer(tc)`: set `selectedVersionIndex.value = 0` before showing the drawer.
- In the **drawer template only**, replace `latestAnalysis(drawerCard)` /
  `latestAnalysis(drawerCard.value)` reads with `selectedAnalysis`:
  result chip (~L200), score meta (~L212-213), summary (~L231-233),
  KPI scores (~L237-253), use-actions (~L256-269), transcript useActions (~L276).
- Drawer header: add the `<select>` (or styled dropdown) bound to
  `selectedVersionIndex`, options generated from `drawerCard.analyses` with label
  `v{analyses.length - i}{ i === 0 ? ' (latest)' : '' }`.
- **Table only**: keep `latestAnalysis(tc)`. Add a `v{tc.analyses.length}` badge
  in the score cell rendered with `v-if="tc.analyses.length > 1"`.

### SSE re-analysis edge case
When an `analysis.complete` / `analysis.failed` event arrives for the open
transcript (`AgentDetail.vue` watcher ~L369-386), the card is refetched and a new
latest version may prepend to `analyses` (index 0).

Decision: **preserve the version the user is reading.**
- If the user was on latest (`selectedVersionIndex === 0`), keep them on index 0 —
  they now see the new latest. (No action needed; index 0 still points at latest.)
- If the user was on an older version (`selectedVersionIndex > 0`), the array grew
  by one at the front, so the previously-selected version shifts by one index. To
  keep showing the *same* analysis, increment `selectedVersionIndex` by the number
  of newly-prepended versions. Implementation: capture the selected analysis `id`
  before refetch and, after refetch, set `selectedVersionIndex` to the index of
  that same `id` in the fresh `analyses` (fallback to 0 if not found).

The id-tracking approach is robust regardless of how many versions arrive and is
the single source of truth for "stay on the version I was reading".

## Testing

Unit test (Vitest) for the selection logic / component behavior:
- Selecting index `i` renders `analyses[i]` (assert score/summary reflect that version).
- Version badge in the table appears only when `analyses.length > 1`, and shows
  `v{length}`.
- Dropdown labels: index 0 → `v{n} (latest)`, last → `v1`.
- SSE arrival: when a new version prepends and the user was on an older version,
  the selection follows the same analysis `id` (index shifts), not the new latest.
- SSE arrival while on latest: stays on latest (index 0).

## Affected files
- `frontend/src/views/AgentDetail.vue` (implementation)
- `frontend/src/views/AgentDetail.test.ts` (tests — extend existing)
