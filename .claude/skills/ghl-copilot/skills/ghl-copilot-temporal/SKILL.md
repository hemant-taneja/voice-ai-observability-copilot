---
name: ghl-copilot-temporal
description: This skill should be used when working with Temporal workflows or activities in the Voice AI Observability Copilot. Also triggers when the user says "add a workflow", "create an activity", "Temporal", "workflow pattern", "retry policy", "worker setup", "durable execution", or needs to understand how the async analysis pipeline works.
---

# Temporal Workflows in the GHL Copilot

## Architecture

The Voice AI Copilot uses Temporal for durable workflow execution. The analysis pipeline is a linear workflow with 7 activities, running in a separate worker process.

```
Main Server (Express)          Worker Process (temporal-worker.ts)
  ├── routes/webhooks.ts          ├── Registered activities (activities/index.ts)
  │    └── Starts workflow ───►   │    ├── loadTranscriptActivity
  │       via Temporal client     │    ├── loadKpiConfigActivity
  │                               │    ├── buildPromptActivity
  │                               │    ├── callLLMActivity
  │                               │    ├── persistResultsActivity
  │                               │    ├── broadcastSSEActivity
  │                               │    └── markFailedActivity
  └── lib/sse-manager.ts    ◄── broadcastSSEActivity (HTTP POST /internal/broadcast)
```

## Key Files

| File | Purpose |
|---|---|
| `workflows/analyze-call.workflow.ts` | Workflow definition — orchestrates activities in sequence |
| `activities/index.ts` | Barrel export of all activities |
| `activities/load-transcript.activity.ts` | Loads transcript from DB |
| `activities/load-kpi-config.activity.ts` | Loads KPI config for agent |
| `activities/build-prompt.activity.ts` | Constructs LLM prompt from transcript + KPI goals |
| `activities/call-llm.activity.ts` | Calls LLM provider, parses response |
| `activities/persist-results.activity.ts` | Saves analysis_results + use_actions to DB |
| `activities/broadcast-sse.activity.ts` | POSTs to main server to trigger SSE push |
| `activities/mark-failed.activity.ts` | Sets transcript status to 'analysis_failed' |
| `workers/temporal-worker.ts` | Worker process setup — registers activities, connects to Temporal |

## Workflow Pattern

```typescript
// workflows/analyze-call.workflow.ts
import { proxyActivities } from '@temporalio/workflow';
import type { Activities } from '../activities';

const activities = proxyActivities<Activities>({
  startToCloseTimeout: '30s',
  retry: { maximumAttempts: 2, initialInterval: '1s' },
});

const llmActivities = proxyActivities<Activities>({
  startToCloseTimeout: '60s',
  retry: { maximumAttempts: 3, initialInterval: '2s', backoffCoefficient: 2 },
});

export async function analyzeCallWorkflow(input: AnalysisJobData): Promise<void> {
  const transcript = await activities.loadTranscriptActivity(input.transcriptId);
  const kpiConfig = await activities.loadKpiConfigActivity(input.agentId);
  const prompt = await activities.buildPromptActivity(transcript, kpiConfig);
  const output = await llmActivities.callLLMActivity(prompt);
  await activities.persistResultsActivity(output, input);
  await activities.broadcastSSEActivity(input.locationId, input.agentId);
}
```

## Activity Pattern

```typescript
// activities/load-transcript.activity.ts
import { db } from '../db';

export async function loadTranscriptActivity(transcriptId: string) {
  const result = await db.query(
    'SELECT * FROM transcripts WHERE id = $1',
    [transcriptId]
  );
  if (result.rows.length === 0) {
    throw new Error(`Transcript ${transcriptId} not found`);
  }
  return result.rows[0];
}
```

**Rules for activities:**
- Activities are regular async functions — no Temporal-specific imports needed
- Activities run in the worker process, not the main server
- Activities can access the database, external APIs, file system
- Activities MUST be deterministic in their side effects when retried
- Export every activity from `activities/index.ts`

## Adding a New Activity

1. Create `activities/<name>.activity.ts`
2. Implement as an async function
3. Export from `activities/index.ts`
4. Register in `workers/temporal-worker.ts` (activities are auto-registered via the barrel export)
5. Add to workflow using `proxyActivities` with appropriate retry policy
6. Write tests mocking DB/external calls

## Retry Policies

| Activity | Max Attempts | Initial Interval | Backoff | Rationale |
|---|---|---|---|---|
| loadTranscript | 2 | 1s | 1x | DB transient failures |
| loadKpiConfig | 2 | 1s | 1x | DB transient failures |
| buildPrompt | 2 | 1s | 1x | Pure computation, rarely fails |
| **callLLM** | **3** | **2s** | **2x exponential** | Rate limits, timeouts |
| persistResults | 2 | 1s | 1x | DB transient failures |
| broadcastSSE | 2 | 1s | 1x | HTTP to main server |
| markFailed | 2 | 1s | 1x | Cleanup — must succeed |

## Worker Configuration

```typescript
// workers/temporal-worker.ts
import { Worker } from '@temporalio/worker';
import * as activities from '../activities';
import { config } from '../config';

async function run() {
  const worker = await Worker.create({
    workflowsPath: require.resolve('../workflows/analyze-call.workflow'),
    activities,
    taskQueue: 'voice-copilot',
    connection: { address: config.temporalAddress },
    namespace: config.temporalNamespace,
  });
  await worker.run();
}
```

## Starting Workflows from Routes

```typescript
// In route handlers
import { Client } from '@temporalio/client';

const temporal = new Client({ connection: { address: config.temporalAddress } });

await temporal.workflow.start('analyzeCallWorkflow', {
  args: [{ transcriptId, agentId, locationId }],
  taskQueue: 'voice-copilot',
  workflowId: `analyze-${transcriptId}`, // Deterministic ID prevents duplicates
});
```

## Failure Handling

When the workflow fails (max retries exhausted):
1. `markFailedActivity` runs in a catch block
2. Sets `transcripts.status = 'analysis_failed'`
3. Pushes SSE event `{ type: 'analysis.failed', agentId }` to dashboard
4. Dashboard shows amber "Analysis failed — retry?" badge
5. User clicks retry -> POST `/api/agents/:id/transcripts/:id/reanalyze` -> starts new workflow

## Additional Resources

For Temporal-specific patterns, upgrade paths, and advanced configuration, consult:
- **`references/workflow-patterns.md`** — Event-driven pipeline upgrade, signals, queries, child workflows
