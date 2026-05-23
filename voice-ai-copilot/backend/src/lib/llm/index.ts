import { LLMProvider } from '../../types/llm.types'
import { OpenAIProvider } from './openai-provider'
import { AnthropicProvider } from './anthropic-provider'
import { config } from '../../config'

export function createLLMProvider(): LLMProvider {
  switch (config.llmProvider) {
    case 'openai':
      return new OpenAIProvider()
    case 'anthropic':
      return new AnthropicProvider()
    default:
      throw new Error(`Unknown LLM provider: ${config.llmProvider}`)
  }
}

export type { LLMProvider }
