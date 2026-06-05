# Voice AI Copilot — Temporal Workflow Patterns Reference

## Current Architecture (Approach 2 — Linear Pipeline)

The current `analyzeCallWorkflow` is a linear sequence of activities. This is simple and correct but couples all steps into a single workflow execution.

```
analyzeCallWorkflow
  → loadTranscript → loadKpiConfig → buildPrompt → callLLM → persistResults → broadcastSSE
```

## Planned Upgrade (Approach 3 — Event-Driven Pipeline)

Split into three chained workflows for independent observability and scaling:

```
IngestWorkflow → signals → AnalysisWorkflow → signals → RecommendationWorkflow
```

### IngestWorkflow
```typescript
export async function ingestWorkflow(input: IngestInput): Promise<void> {
  const transcript = await activities.parseTranscriptActivity(input.payload);
  await activities.persistTranscriptActivity(transcript);
  // Signal next workflow
  const handle = await workflow.startChild('analysisWorkflow', {
    args: [{ transcriptId: transcript.id, agentId: input.agentId }],
    taskQueue: 'voice-copilot',
  });
}
```

### AnalysisWorkflow
```typescript
export async function analysisWorkflow(input: AnalysisInput): Promise<void> {
  const transcript = await activities.loadTranscriptActivity(input.transcriptId);
  const kpiConfig = await activities.loadKpiConfigActivity(input.agentId);
  const prompt = await activities.buildPromptActivity(transcript, kpiConfig);
  const output = await llmActivities.callLLMActivity(prompt);
  await activities.persistResultsActivity(output, input);
  // Signal recommendation workflow
  await workflow.startChild('recommendationWorkflow', {
    args: [{ analysisId: output.id, agentId: input.agentId }],
  });
}
```

### RecommendationWorkflow
```typescript
export async function recommendationWorkflow(input: RecommendationInput): Promise<void> {
  const analysis = await activities.loadAnalysisActivity(input.analysisId);
  const suggestions = await llmActivities.generateSuggestionsActivity(analysis);
  await activities.persistSuggestionsActivity(suggestions);
  await activities.broadcastSSEActivity(input.locationId, input.agentId);
}
```

**Benefits of Approach 3:**
- Each stage independently retryable and observable in Temporal UI
- Ingestion completes fast (no LLM wait)
- Analysis and recommendation can be rerun independently
- Natural scaling — different task queues per stage
- No changes to routes, services, or frontend

**When to upgrade:** When analysis volume exceeds single-workflow throughput or when independent retry/observability per stage becomes necessary.

## Temporal Signals

Use signals to coordinate between workflows or receive external input:

```typescript
// Define signal
const retrySignal = defineSignal('retry');

// In workflow
export async function analysisWorkflow(input: AnalysisInput): Promise<void> {
  let shouldRetry = false;
  setHandler(retrySignal, () => { shouldRetry = true; });

  try {
    // ... normal flow
  } catch (err) {
    await activities.markFailedActivity(input.transcriptId);
    // Wait for retry signal
    await condition(() => shouldRetry);
    shouldRetry = false;
    // Re-run analysis
  }
}

// From route handler, signal the workflow
await temporal.workflow.getHandle(workflowId).signal(retrySignal);
```

## Temporal Queries

Query running workflows for status:

```typescript
// Define query
const statusQuery = defineQuery<AnalysisStatus>('status');

// In workflow
setHandler(statusQuery, () => ({
  stage: currentStage,
  progress: completedActivities / totalActivities,
  lastError: lastError?.message,
}));

// From route handler
const status = await temporal.workflow.getHandle(workflowId).query(statusQuery);
```

## Child Workflows

For the Approach 3 upgrade, use child workflows:

```typescript
import { startChild } from '@temporalio/workflow';

const childHandle = await startChild('analysisWorkflow', {
  args: [input],
  taskQueue: 'voice-copilot',
  workflowId: `analysis-${transcriptId}`,
});
await childHandle.result(); // Wait for completion
```

## Multiple Task Queues

For scaling different stages independently:

```typescript
// Worker for ingestion
const ingestWorker = await Worker.create({
  taskQueue: 'voice-copilot-ingest',
  activities: ingestActivities,
});

// Worker for analysis (GPU-heavy LLM calls)
const analysisWorker = await Worker.create({
  taskQueue: 'voice-copilot-analysis',
  activities: analysisActivities,
});
```

## Testing Workflows

### Unit Testing with Mocked Activities

```typescript
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';

describe('analyzeCallWorkflow', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  it('calls activities in correct order', async () => {
    const callOrder: string[] = [];
    const mockActivities = {
      loadTranscriptActivity: async () => { callOrder.push('load'); return {}; },
      loadKpiConfigActivity: async () => { callOrder.push('kpi'); return {}; },
      buildPromptActivity: async () => { callOrder.push('prompt'); return {}; },
      callLLMActivity: async () => { callOrder.push('llm'); return {}; },
      persistResultsActivity: async () => { callOrder.push('persist'); },
      broadcastSSEActivity: async () => { callOrder.push('broadcast'); },
    };

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      workflowsPath: require.resolve('../workflows/analyze-call.workflow'),
      activities: mockActivities,
      taskQueue: 'test',
    });

    await worker.runUntil(
      testEnv.client.workflow.execute('analyzeCallWorkflow', {
        args: [{ transcriptId: '1', agentId: '2', locationId: '3' }],
        taskQueue: 'test',
        workflowId: 'test-1',
      })
    );

    expect(callOrder).toEqual(['load', 'kpi', 'prompt', 'llm', 'persist', 'broadcast']);
  });
});
```

### Testing Activity Failures

```typescript
it('marks transcript as failed when LLM activity exceeds retries', async () => {
  const mockActivities = {
    loadTranscriptActivity: async () => ({}),
    loadKpiConfigActivity: async () => ({}),
    buildPromptActivity: async () => ({}),
    callLLMActivity: async () => { throw new Error('Rate limited'); },
    markFailedActivity: jest.fn(),
  };

  // Workflow should catch and call markFailed
  // Verify markFailedActivity was called
});
```

## Monitoring and Debugging

### Temporal UI (http://localhost:8080)
- View all workflow executions
- Filter by workflow type, status, time range
- Inspect individual activities and their inputs/outputs
- See retry attempts and error messages
- Terminate or cancel stuck workflows

### Common Issues
1. **Worker not connected:** Activities stay in "Scheduled" state
2. **Activity timeout:** Increase `startToCloseTimeout` for LLM calls
3. **Workflow ID conflict:** Use deterministic IDs to prevent duplicates
4. **Namespace mismatch:** Worker and client must use same namespace
