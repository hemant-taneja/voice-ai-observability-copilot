import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { LLMProvider, AnalysisPrompt, AnalysisOutput } from '../../types/llm.types'
import { KpiGoal } from '../../types/analysis.types'
import { buildActionsSection } from './action-prompt'

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
  actionFindings: z.array(z.object({
    ghlActionId: z.string().nullable().default(null),
    actionType: z.string(),
    actionName: z.string(),
    transcriptTurnIndex: z.number().int().min(0),
    status: z.enum(['correct', 'missed', 'incorrect']),
    description: z.string(),
    promptFlaw: z.string().nullable().optional(),
    suggestedTriggerPrompt: z.string().nullable().optional(),
  })).default([]),
})

const kpiGoalSchema = z.array(z.object({
  name: z.string(),
  description: z.string(),
  weight: z.number().min(0).max(1),
}))

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

Scoring rules:
- Score each KPI solely on what happened in the transcript.
- If a KPI goal was NOT testable (e.g. the KPI is "handle objections" but no objections arose), score it 1.0 — the agent cannot be penalised for situations that never occurred.
- Only score a KPI below 1.0 if the agent had a clear opportunity and failed to act.
- Set "passed" per KPI to true if score >= 0.7.

${buildActionsSection(prompt)}

Return ONLY valid JSON: { "overallScore": <weighted average 0-1>, "passed": <bool>, "kpiScores": [...], "summary": "...", "useActions": [...], "scriptSuggestions": [{ "sectionTitle": "...", "issue": "...", "currentApproach": "...", "suggestedScript": "...", "impact": "..." }], "actionFindings": [{ "ghlActionId": <string|null>, "actionType": "...", "actionName": "...", "transcriptTurnIndex": <int>, "status": "correct|missed|incorrect", "description": "...", "promptFlaw": <string|null>, "suggestedTriggerPrompt": <string|null> }] }
Only include scriptSuggestions for failed KPIs or clear deviations. Leave the array empty if the call passed all KPIs.`

    const turns = prompt.turns
      .map((t, i) => `[${i}] ${t.speaker.toUpperCase()}: ${t.text}`)
      .join('\n')

    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 2048,
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

  async suggestKpiGoals(script: string): Promise<KpiGoal[]> {
    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 1024,
      system: `You are an expert at defining measurable KPI goals for AI voice agents.
Given the agent's script or instructions, derive 2-5 specific, measurable KPI goals.
Each goal must be something an evaluator can clearly determine from a call transcript.
Weights must sum to 1.0.
Return ONLY valid JSON: { "goals": [{ "name": "...", "description": "...", "weight": <0-1> }] }`,
      messages: [{ role: 'user', content: `Agent script:\n${script}` }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Anthropic returned no text content')
    }

    const parsed = kpiGoalSchema.safeParse(JSON.parse(textBlock.text).goals)
    if (!parsed.success) {
      throw new Error(`KPI suggestion output failed validation: ${parsed.error.toString()}`)
    }

    return parsed.data
  }
}
