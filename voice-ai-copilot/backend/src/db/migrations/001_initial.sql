CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS locations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      VARCHAR(255) UNIQUE NOT NULL,
  name             VARCHAR(255),
  access_token     TEXT,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  VARCHAR(255) NOT NULL REFERENCES locations(location_id) ON DELETE CASCADE,
  ghl_agent_id VARCHAR(255) NOT NULL,
  name         VARCHAR(255) NOT NULL,
  script       TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, ghl_agent_id)
);

CREATE TABLE IF NOT EXISTS kpi_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  goals             JSONB NOT NULL DEFAULT '[]',
  success_threshold DECIMAL(3,2) NOT NULL DEFAULT 0.70,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT kpi_configs_agent_id_unique UNIQUE (agent_id)
);

CREATE TABLE IF NOT EXISTS transcripts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id         UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  location_id      VARCHAR(255) NOT NULL,
  ghl_call_id      VARCHAR(255) UNIQUE NOT NULL,
  caller_phone     VARCHAR(50),
  duration_seconds INTEGER,
  status           VARCHAR(50) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'analyzed', 'analysis_failed')),
  turns            JSONB NOT NULL DEFAULT '[]',
  raw_payload      JSONB,
  ingested_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analysis_results (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id  UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  kpi_config_id  UUID NOT NULL REFERENCES kpi_configs(id),
  overall_score  DECIMAL(3,2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 1),
  passed         BOOLEAN NOT NULL,
  kpi_scores     JSONB NOT NULL DEFAULT '[]',
  summary        TEXT NOT NULL,
  llm_provider   VARCHAR(50) NOT NULL,
  llm_model      VARCHAR(100) NOT NULL,
  analyzed_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS use_actions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id           UUID NOT NULL REFERENCES analysis_results(id) ON DELETE CASCADE,
  transcript_turn_index INTEGER NOT NULL,
  type                  VARCHAR(50) NOT NULL
                        CHECK (type IN ('missed_opportunity', 'deviation', 'escalation_needed')),
  description           TEXT NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_location_id        ON agents(location_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_agent_id      ON transcripts(agent_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_status        ON transcripts(status);
CREATE INDEX IF NOT EXISTS idx_analysis_transcript_id    ON analysis_results(transcript_id);
CREATE INDEX IF NOT EXISTS idx_use_actions_analysis_id   ON use_actions(analysis_id);
