// Set env vars before any module imports that trigger config.ts validation
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/voice_copilot_test'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.TEMPORAL_ADDRESS = 'localhost:7233'
process.env.GHL_WEBHOOK_SECRET = 'test'
process.env.LLM_PROVIDER = 'openai'
process.env.OPENAI_API_KEY = 'sk-test'
process.env.NODE_ENV = 'test'

import { TestWorkflowEnvironment } from '@temporalio/testing'
import { Worker } from '@temporalio/worker'
import { analyzeCallWorkflow, AnalyzeCallInput } from './analyze-call.workflow'
import * as activities from '../activities/index'

describe('analyzeCallWorkflow', () => {
  let env: TestWorkflowEnvironment

  beforeAll(async () => {
    env = await TestWorkflowEnvironment.createLocal()
  }, 60_000)

  afterAll(async () => {
    await env.teardown()
  })

  it('completes successfully with mocked activities', async () => {
    const mockActivities: typeof activities = {
      loadTranscript: jest.fn().mockResolvedValue({
        id: 'tr-1', agentId: 'ag-1', locationId: 'loc-1',
        turns: [{ speaker: 'agent', text: 'Hi', timestamp_ms: 0 }],
        durationSeconds: 60,
      }),
      loadKpiConfig: jest.fn().mockResolvedValue({
        goals: [{ name: 'Book Appointment', description: 'Confirm slot', weight: 1 }],
        passThreshold: 0.7,
      }),
      buildPrompt: jest.fn().mockResolvedValue({
        agentScript: 'Book appointments.',
        turns: [{ speaker: 'agent', text: 'Hi', timestamp_ms: 0 }],
        kpiGoals: [{ name: 'Book Appointment', description: 'Confirm slot', weight: 1 }],
        actions: [],
        executedActions: [],
      }),
      callLLM: jest.fn().mockResolvedValue({
        overallScore: 0.85, passed: true,
        kpiScores: [{ goal: 'Book Appointment', score: 0.85, passed: true, evidence: 'Confirmed 3pm' }],
        summary: 'Good call.', useActions: [], scriptSuggestions: [], actionFindings: [],
        provider: 'openai', model: 'gpt-4o',
      }),
      persistResults: jest.fn().mockResolvedValue('ar-1'),
      broadcastSSE: jest.fn().mockResolvedValue(undefined),
      broadcastSSEFailure: jest.fn().mockResolvedValue(undefined),
      markTranscriptFailed: jest.fn().mockResolvedValue(undefined),
    }

    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue: 'test-queue',
      workflowsPath: require.resolve('./analyze-call.workflow'),
      activities: mockActivities,
    })

    const input: AnalyzeCallInput = {
      transcriptId: 'tr-1', agentId: 'ag-1',
      locationId: 'loc-1', kpiConfigId: 'kpi-1',
    }

    await worker.runUntil(
      env.client.workflow.execute(analyzeCallWorkflow, {
        taskQueue: 'test-queue',
        workflowId: 'test-wf-1',
        args: [input],
      })
    )

    expect(mockActivities.callLLM).toHaveBeenCalledTimes(1)
    expect(mockActivities.persistResults).toHaveBeenCalledTimes(1)
    expect(mockActivities.broadcastSSE).toHaveBeenCalledWith('loc-1', 'ag-1')
  }, 90_000)
})
