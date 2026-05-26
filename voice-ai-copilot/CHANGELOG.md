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
