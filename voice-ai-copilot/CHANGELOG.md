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
- Migration runner now applies every `*.sql` file in `db/migrations` in order, instead of a hardcoded `001`/`002` list, so new migrations (e.g. the action-analytics schema) are actually created on deploy rather than being silently skipped
