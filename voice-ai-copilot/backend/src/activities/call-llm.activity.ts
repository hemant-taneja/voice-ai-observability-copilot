import { createLLMClient } from '../lib/llm/index'
import { AnalysisPrompt, AnalysisOutput } from '../types/llm.types'

export async function callLLM(prompt: AnalysisPrompt): Promise<AnalysisOutput & { provider: string; model: string }> {
  const client = createLLMClient()
  const output = await client.analyze(prompt)
  return { ...output, provider: client.providerName, model: client.modelName }
}
