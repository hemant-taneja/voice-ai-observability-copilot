import OpenAI from 'openai'
import { z } from 'zod'
import { LLMProvider, AnalysisPrompt, AnalysisOutput } from '../../types/llm.types'
import { KpiGoal } from '../../types/analysis.types'

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
  scriptSuggestions: z.array(z.object({
    sectionTitle: z.string(),
    issue: z.string(),
    currentApproach: z.string(),
    suggestedScript: z.string(),
    impact: z.string(),
  })).default([]),
})

const kpiGoalSchema = z.array(z.object({
  name: z.string(),
  description: z.string(),
  weight: z.number().min(0).max(1),
}))

function buildSystemPrompt(prompt: AnalysisPrompt): string {
  const goals = prompt.kpiGoals
    .map((g, i) => `${i + 1}. ${g.name} (weight: ${g.weight}): ${g.description}`)
    .join('\n')

  return `You are a Voice AI call quality analyst. Evaluate the following call transcript against the agent's KPIs.

Agent Script/Goal:
${prompt.agentScript}

KPI Goals to evaluate:
${goals}

Scoring rules:
- Score each KPI solely on what happened in the transcript.
- If a KPI goal was NOT testable in this call (e.g. the KPI is "handle objections" but no objections arose, or "upsell" but the customer bought without prompting), score it 1.0 — the agent cannot be penalised for situations that never occurred.
- Only score a KPI below 1.0 if the agent had a clear opportunity and failed to act.
- Set "passed" per KPI to true if score >= 0.7.
- Set the top-level "passed" to true if the weighted average of KPI scores meets the success threshold.

Return ONLY a JSON object matching this exact structure — no markdown, no explanation:
{
  "overallScore": <weighted average 0-1>,
  "passed": <boolean>,
  "kpiScores": [{ "goal": "<name>", "score": <0-1>, "passed": <boolean>, "evidence": "<quote from transcript or clear reason>" }],
  "summary": "<2-3 sentence call summary>",
  "useActions": [{ "transcriptTurnIndex": <int>, "type": "<missed_opportunity|deviation|escalation_needed>", "description": "<what happened and why it matters>" }],
  "scriptSuggestions": [{ "sectionTitle": "<script section name>", "issue": "<what went wrong>", "currentApproach": "<what agent said/did>", "suggestedScript": "<exact replacement text for the script>", "impact": "<which KPI this improves and why>" }]
}

Only include scriptSuggestions for failed KPIs or clear deviations. Leave the array empty if the call passed all KPIs.`
}

function buildUserPrompt(prompt: AnalysisPrompt): string {
  const turns = prompt.turns
    .map((t, i) => `[${i}] ${t.speaker.toUpperCase()}: ${t.text}`)
    .join('\n')
  return `Transcript:\n${turns}`
}

interface OpenAIProviderOptions {
  apiKey?: string
  baseURL?: string
  model?: string
  providerName?: string
}

export class OpenAIProvider implements LLMProvider {
  readonly providerName: string
  readonly modelName: string

  private client: OpenAI

  constructor(options: OpenAIProviderOptions = {}) {
    this.providerName = options.providerName ?? 'openai'
    this.modelName = options.model ?? 'gpt-4o'
    this.client = new OpenAI({
      apiKey: options.apiKey ?? process.env.OPENAI_API_KEY,
      baseURL: options.baseURL,
    })
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

  async suggestKpiGoals(script: string): Promise<KpiGoal[]> {
    const response = await this.client.chat.completions.create({
      model: this.modelName,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an expert at defining measurable KPI goals for AI voice agents.
Given the agent's script or instructions, derive 2-5 specific, measurable KPI goals.
Each goal must be something an evaluator can clearly determine from a call transcript.
Weights must sum to 1.0.

Return ONLY a JSON object: { "goals": [{ "name": "<concise goal name>", "description": "<what success looks like — be specific and observable>", "weight": <0.1-0.7> }] }`,
        },
        {
          role: 'user',
          content: `Agent script:\n${script}`,
        },
      ],
      temperature: 0.3,
    })

    const raw = response.choices[0]?.message?.content
    if (!raw) throw new Error('OpenAI returned empty content')

    const parsed = kpiGoalSchema.safeParse(JSON.parse(raw).goals)
    if (!parsed.success) {
      throw new Error(`KPI suggestion output failed validation: ${parsed.error.toString()}`)
    }

    return parsed.data
  }
}
