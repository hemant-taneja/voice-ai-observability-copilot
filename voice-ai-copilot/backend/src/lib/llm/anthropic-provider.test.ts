import { AnthropicProvider } from './anthropic-provider'
import { AnalysisPrompt } from '../../types/llm.types'

const mockCreate = jest.fn()

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

const validOutput = {
  overallScore: 0.55,
  passed: false,
  kpiScores: [{ goal: 'Qualify Lead', score: 0.55, passed: false, evidence: 'Budget not confirmed' }],
  summary: 'Agent failed to qualify the lead properly.',
  useActions: [{ transcriptTurnIndex: 3, type: 'missed_opportunity', description: 'Did not ask about budget' }],
}

const prompt: AnalysisPrompt = {
  agentScript: 'Qualify leads by confirming budget and need.',
  turns: [{ speaker: 'agent', text: 'Are you interested?', timestamp_ms: 0 }],
  kpiGoals: [{ name: 'Qualify Lead', description: 'Confirm budget and need', weight: 1 }],
  actions: [],
  executedActions: [],
}

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    mockCreate.mockReset()
    provider = new AnthropicProvider()
  })

  it('parses valid Anthropic response into AnalysisOutput', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(validOutput) }],
    })
    const result = await provider.analyze(prompt)
    expect(result.overallScore).toBe(0.55)
    expect(result.passed).toBe(false)
    expect(result.useActions).toHaveLength(1)
  })

  it('parses actionFindings into AnalysisOutput', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({
        ...validOutput,
        actionFindings: [
          { ghlActionId: null, actionType: 'CALL_TRANSFER', actionName: 'Transfer to AE', transcriptTurnIndex: 2, status: 'incorrect', description: 'Transferred without qualifying', promptFlaw: 'no guard condition', suggestedTriggerPrompt: 'Only transfer after budget confirmed' },
        ],
      }) }],
    })
    const result = await provider.analyze(prompt)
    expect(result.actionFindings).toHaveLength(1)
    expect(result.actionFindings[0].status).toBe('incorrect')
  })

  it('throws on invalid JSON from Anthropic', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'oops' }] })
    await expect(provider.analyze(prompt)).rejects.toThrow()
  })
})
