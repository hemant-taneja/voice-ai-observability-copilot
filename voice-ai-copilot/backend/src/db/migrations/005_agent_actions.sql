-- 005_agent_actions.sql
-- Action (tool-call) analytics layer.
--
-- GHL Voice AI agents carry "Actions" — tool calls the agent invokes mid-call
-- (SMS, appointment booking, call transfer, custom webhook, …). Each action's
-- invocation logic lives in its actionParameters.triggerPrompt. This migration
-- adds three tables:
--   agent_actions       — synced action DEFINITIONS per agent (incl. trigger_prompt)
--   transcript_actions  — deterministic record of which actions FIRED per call,
--                         parsed from the VoiceAiCallEnd webhook's executedCallActions
--   action_findings     — per-analysis-run JUDGMENTS (correct/missed/incorrect) plus
--                         the diagnosed flaw in the action's trigger_prompt
--
-- NOTE: distinct from the existing `use_actions` table, which holds LLM coaching
-- flags (missed_opportunity/deviation/escalation_needed) and is unrelated.

-- ── Action definitions (synced from GHL) ──────────────────
CREATE TABLE IF NOT EXISTS agent_actions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  ghl_action_id VARCHAR(255) NOT NULL,
  action_type   VARCHAR(64) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  trigger_prompt  TEXT,
  trigger_message TEXT,
  parameters    JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, ghl_action_id)
);

-- ── Deterministic per-call fires (from webhook executedCallActions) ──
CREATE TABLE IF NOT EXISTS transcript_actions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id       UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  ghl_action_id       VARCHAR(255),
  action_type         VARCHAR(64) NOT NULL,
  action_name         VARCHAR(255) NOT NULL,
  parameters          JSONB NOT NULL DEFAULT '{}',
  executed_at         TIMESTAMPTZ,
  trigger_received_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Per-analysis-run action judgments (versioned, like use_actions) ──
CREATE TABLE IF NOT EXISTS action_findings (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id              UUID NOT NULL REFERENCES analysis_results(id) ON DELETE CASCADE,
  agent_action_id          UUID REFERENCES agent_actions(id) ON DELETE SET NULL,
  ghl_action_id            VARCHAR(255),
  action_type              VARCHAR(64),
  action_name              VARCHAR(255),
  transcript_turn_index    INTEGER NOT NULL DEFAULT 0,
  status                   VARCHAR(20) NOT NULL
                           CHECK (status IN ('correct', 'missed', 'incorrect')),
  description              TEXT NOT NULL,
  prompt_flaw              TEXT,
  suggested_trigger_prompt TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_agent_id        ON agent_actions(agent_id);
CREATE INDEX IF NOT EXISTS idx_transcript_actions_transcript ON transcript_actions(transcript_id);
CREATE INDEX IF NOT EXISTS idx_action_findings_analysis_id   ON action_findings(analysis_id);
