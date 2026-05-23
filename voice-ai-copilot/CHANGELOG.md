# Changelog

All notable changes are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]

### Added
- Full Voice AI Observability Copilot — initial implementation
- GHL webhook handler with HMAC-SHA256 signature verification and call idempotency
- Provider-agnostic LLM adapter supporting OpenAI (gpt-4o) and Anthropic (claude-3-5-haiku)
- Temporal workflow for durable, retry-safe LLM analysis pipeline
- SSE endpoint for live dashboard updates on workflow completion
- Dashboard view: aggregate metrics, agent health grid, breathing signal waveform indicator
- AgentDetail view: KPI scorecard, recommendation panel, annotated transcript viewer
- KPI configuration editor — users set goal names, weights, and pass threshold per agent
- Seed data — 3 agents with 60 transcripts, analyses, and use actions for demo
- GHL custom JS widget (inject.js) for embedding the copilot in GHL accounts
- README with architecture, real vs mocked table, and Approach 3 upgrade path
