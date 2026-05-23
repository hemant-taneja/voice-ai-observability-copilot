import { OpenAIProvider } from './openai-provider'
import { AnalysisPrompt } from '../../types/llm.types'

const mockCreate = jest.fn()

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  }
})

const validOutput = {
  overallScore: 0.82,
  passed: true,
  kpiScores: [{ goal: 'Book Appointment', score: 0.9, passed: true, evidence: 'Agent confirmed slot at 3pm' }],
  summary: 'Agent successfully booked appointment.',
  useActions: [],
}

const prompt: AnalysisPrompt = {
  agentScript: 'You are a booking agent.',
  turns: [
    { speaker: 'agent', text: 'Hi, are you available at 3pm?', timestamp_ms: 0 },
    { speaker: 'user', text: 'Yes, works for me.', timestamp_ms: 4000 },
  ],
  kpiGoals: [{ name: 'Book Appointment', description: 'Secure a confirmed booking', weight: 1 }],
}

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-test'
    mockCreate.mockReset()
    provider = new OpenAIProvider()
  })

  it('parses a valid LLM response into AnalysisOutput', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validOutput) } }],
    })
    const result = await provider.analyze(prompt)
    expect(result.overallScore).toBe(0.82)
    expect(result.passed).toBe(true)
    expect(result.kpiScores).toHaveLength(1)
  })

  it('throws when LLM returns invalid JSON', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'not json at all' } }],
    })
    await expect(provider.analyze(prompt)).rejects.toThrow()
  })

  it('throws when LLM returns JSON missing required fields', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ overallScore: 0.5 }) } }],
    })
    await expect(provider.analyze(prompt)).rejects.toThrow()
  })
})
