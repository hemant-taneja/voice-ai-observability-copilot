import OpenAI from 'openai'
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

function buildSystemPrompt(prompt: AnalysisPrompt): string {
  const goals = prompt.kpiGoals
    .map((g, i) => `${i + 1}. ${g.name} (weight: ${g.weight}): ${g.description}`)
    .join('\n')

  return `You are a Voice AI call quality analyst. Evaluate the following call transcript against the agent's KPIs.

Agent Script/Goal:
${prompt.agentScript}

KPI Goals to evaluate:
${goals}

Return ONLY a JSON object matching this exact structure — no markdown, no explanation:
{
  "overallScore": <number 0-1>,
  "passed": <boolean>,
  "kpiScores": [{ "goal": "<name>", "score": <0-1>, "passed": <boolean>, "evidence": "<quote or reason>" }],
  "summary": "<2-3 sentence call summary>",
  "useActions": [{ "transcriptTurnIndex": <int>, "type": "<missed_opportunity|deviation|escalation_needed>", "description": "<what happened and why it matters>" }]
}`
}

function buildUserPrompt(prompt: AnalysisPrompt): string {
  const turns = prompt.turns
    .map((t, i) => `[${i}] ${t.speaker.toUpperCase()}: ${t.text}`)
    .join('\n')
  return `Transcript:\n${turns}`
}

export class OpenAIProvider implements LLMProvider {
  readonly providerName = 'openai'
  readonly modelName = 'gpt-4o'

  private client: OpenAI

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }

  async analyze(prompt: AnalysisPrompt): Promise<AnalysisOutput> {
    const response = await this.client.chat.completions.create({
      model: this.modelName,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt(prompt) },
        { role: 'user', content: buildUserPrompt(prompt) },
      ],
      temperature: 0.2,
    })

    const raw = response.choices[0]?.message?.content
    if (!raw) throw new Error('OpenAI returned empty content')

    const parsed = outputSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      throw new Error(`LLM output failed validation: ${parsed.error.toString()}`)
    }

    return parsed.data
  }
}
