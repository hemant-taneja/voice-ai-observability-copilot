import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { LLMProvider, AnalysisPrompt, AnalysisOutput } from '../../types/llm.types'

const outputSchema = z.object({
  overallScore: z.number().min(0).max(1),
  passed: z.boolean(),
  kpiScores: z.array(z.object({
    goal: z.string(),
    score: z.number().min(0).max(1),
    passed: z.boolean(),
    evidence: z.string(),
  })),
  summary: z.string(),
  useActions: z.array(z.object({
    transcriptTurnIndex: z.number().int().min(0),
    type: z.enum(['missed_opportunity', 'deviation', 'escalation_needed']),
    description: z.string(),
  })),
})

export class AnthropicProvider implements LLMProvider {
  readonly providerName = 'anthropic'
  readonly modelName = 'claude-3-5-haiku-20241022'

  private client: Anthropic

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }

  async analyze(prompt: AnalysisPrompt): Promise<AnalysisOutput> {
    const systemPrompt = `You are a Voice AI call quality analyst. Evaluate the transcript against the agent's KPIs.

Agent Script/Goal: ${prompt.agentScript}

KPIs:
${prompt.kpiGoals.map((g, i) => `${i + 1}. ${g.name} (weight: ${g.weight}): ${g.description}`).join('\n')}

Return ONLY valid JSON: { "overallScore": <0-1>, "passed": <bool>, "kpiScores": [...], "summary": "...", "useActions": [...] }`

    const turns = prompt.turns
      .map((t, i) => `[${i}] ${t.speaker.toUpperCase()}: ${t.text}`)
      .join('\n')

    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Transcript:\n${turns}` }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Anthropic returned no text content')
    }

    const parsed = outputSchema.safeParse(JSON.parse(textBlock.text))
    if (!parsed.success) {
      throw new Error(`LLM output failed validation: ${parsed.error.toString()}`)
    }

    return parsed.data
  }
}
