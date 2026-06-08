# Changelog

All notable changes to the Voice AI Observability Copilot are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

## [Unreleased]

### Added
- Action (tool-call) analytics layer so managers can see whether a voice agent invoked the right tools (SMS, appointment booking, transfer, custom webhook) at the right moments during a call
- Agent action definitions — including each action's `triggerPrompt` invocation logic — are now synced from GoHighLevel during agent sync (`GHLClient.getAgentActions` + `ActionsService`) so the analyzer knows which tools an agent is supposed to use
- Deterministic per-call tool-call records parsed from the `VoiceAiCallEnd` webhook's `executedCallActions`, so "did this action fire?" is ground truth rather than inferred from transcript text
- Per-call action findings (`correct` / `missed` / `incorrect`) from the analysis LLM, and for a missed or incorrect invocation it diagnoses the flaw in the action's `triggerPrompt` and suggests a rewrite — so a recurring miss points straight at the prompt that needs fixing
- `GET /api/agents/:id/actions/analytics` endpoint returning a per-action rollup (fire count, missed/incorrect counts, latest flagged trigger-prompt flaw + suggested rewrite)
- Inline tool-call markers in the transcript viewer (icon by action type, color by correct/missed/incorrect) plus an Action Analytics panel and an Action Findings block in the call drawer
- Simulator now carries mock `executedCallActions` so the full action-analytics pipeline can be exercised offline end-to-end
- Six new simulator test cases with script deviations and escalation scenarios so simulation covers missed opportunities, false promises, compliance blockers, and threatening callers across all three agents
- Inline script diff panel in the agent script editor so managers can review LLM-suggested script changes with red/green line highlighting before saving
- "Mark as handled" button on escalation_needed use action badges, using a dedicated localStorage key so handled state is tracked separately from regular reviewed state
- Escalation banner at the top of the agent detail page that counts unhandled escalations and is dismissible per session
- Toast notifications for analysis.complete and analysis.failed SSE events so users get immediate visual feedback when Temporal analysis finishes
- analysis.failed SSE events now trigger a data refresh so the failed status pill appears without a page reload

### Fixed
- Voice AI call transcripts now parse correctly — GHL's `VoiceAiCallEnd` webhook uses lowercase `bot:`/`human:` speaker labels, which the parser didn't recognize, so every real call collapsed into a single unusable agent turn instead of alternating speaker turns
- Webhook handler no longer silently skips analysis — when a transcript is ingested but the workflow isn't started, it now logs the reason (duplicate call vs. agent missing a KPI config) instead of leaving the call stranded at `pending` with no explanation
- Migration runner now applies every `*.sql` file in `db/migrations` in order, instead of a hardcoded `001`/`002` list, so new migrations (e.g. the action-analytics schema) are actually created on deploy rather than being silently skipped
- Executed actions now persist their GHL id — the live `VoiceAiCallEnd` webhook sends the action id as `actionId` (not the documented `_id`), so every fired tool-call was stored with a NULL id; this broke the analytics fire-count join and fed the analyzer an `[id: unknown]` action list, causing a correctly-fired transfer to be flagged `incorrect`/`missed`
- Action findings now link back to their synced definition by id or by action type+name (and the analyzer's occasional `[id: ...]` wrapper is stripped), so a finding no longer ends up orphaned with a NULL `agent_action_id`
- A fired action can no longer be labelled `missed`: the persist step coerces such a verdict to `incorrect`, since `executedCallActions` is ground truth that the tool ran

### Changed
- Webhook and transcript ingestion now log the incoming `VoiceAiCallEnd` transcript shape and `executedCallActions` so action persistence can be diagnosed against deployed GHL traffic
- Action analyzer now judges the agent's *decision* to invoke a tool against its `triggerPrompt`, not the tool's external outcome — a call transfer that fired correctly but failed to connect is `correct`, not a `triggerPrompt` flaw, so telephony failures no longer generate bogus prompt-rewrite suggestions
