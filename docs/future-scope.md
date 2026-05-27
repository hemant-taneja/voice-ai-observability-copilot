# Future Scope

## Near Term

### Automatic token refresh
GHL OAuth tokens expire in ~24 hours. Currently there is no automatic refresh — after expiry, agent sync and any GHL API calls will return 401.

**Fix:** Background job (cron or Temporal workflow) that runs every 20 hours, queries for tokens expiring within 4 hours, and calls GHL's token refresh endpoint using the stored `refresh_token`.

### Auto-sync agents on install
Currently agents must be synced manually via `POST /api/agents/sync` after a sub-account installs the app.

**Fix:** Call `upsertFromGHL()` automatically inside `mintAndStoreLocationToken()` right after storing the location token. Agents appear in the dashboard immediately post-install.

### Notification panel
Toast notifications disappear. A manager who steps away during analysis misses the result.

**Fix:** Replace (or supplement) toasts with a persistent notification panel in the sidebar showing the last N analysis completions with agent name, score, and pass/fail — clickable to jump to the transcript.

---

## Medium Term

### Performance trend tracking
Today the dashboard shows a snapshot — current pass rate, current avg score. There is no sense of whether an agent is improving or declining.

**Fix:** Track daily/weekly aggregates in a `agent_stats` table. Show sparkline trends on agent cards and a trend chart in agent detail.

### Multi-location agency view
Agency managers oversee many sub-accounts. Currently they must switch locations manually to see each one.

**Fix:** Add an agency-level dashboard that aggregates metrics across all locations. Requires querying across location_ids associated with a company token.

### Review notes persistence
Transcript annotations and review comments are stored in frontend Pinia store only. They are lost on page refresh.

**Fix:** Backend `reviews` table keyed by `(analysis_id, user_id)`. API endpoints for create/read/update. Visible in transcript detail alongside use actions.

### Failed analysis recovery UI
Transcripts with `status = 'analysis_failed'` are visible in the DB but not surfaced prominently in the UI.

**Fix:** Show failed transcripts in agent detail with a "Retry Analysis" button that calls the existing `/reanalyze` endpoint.

---

## Long Term

### Real-time call coaching
Instead of analysing after the call ends, provide the agent with live hints during the call based on the conversation trajectory.

**Approach:** Use GHL's live call stream API (if available) or integrate with the underlying telephony provider. Run a streaming LLM inference that suggests next steps every few turns.

### A/B script testing
Run two versions of an agent script simultaneously across a cohort of calls and compare KPI outcomes statistically.

**Approach:** Add a `script_variant` field to agents. Randomly assign incoming calls to variants at ingest time. Add a comparison view in the UI that shows score distributions side-by-side.

### Automated script updates
Close the feedback loop: approved script suggestions get pushed directly back to GHL via the Voice AI agents write API without manual copy-paste.

**Approach:** Add an "Approve & Push" button on script suggestions. Backend calls `PATCH /voice-ai/agents` with the updated script using the stored location token.

### Fine-tuned scoring model
Replace the general-purpose LLM with a domain-specific scoring model trained on accumulated transcripts + human-reviewed scores.

**Approach:** Export labeled transcripts as training data. Fine-tune a small model (e.g. GPT-4o mini, Claude Haiku) on the call scoring task. Reduces latency from ~15s to ~2s and cost by ~10×. The provider abstraction in `callLLM` makes swapping straightforward.

### Multilingual support
GHL Voice AI operates in multiple languages. Currently the transcript parser and LLM prompt are English-only.

**Fix:** Detect transcript language at ingest time. Pass language to the prompt. Use a multilingual LLM or translate to English before analysis.
