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
    case 'groq':
      return new OpenAIProvider({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
        model: 'llama-3.3-70b-versatile',
        providerName: 'groq',
      })
    default:
      throw new Error(`Unknown LLM provider: ${config.llmProvider}`)
  }
}

// Alias used by the call-llm activity
export const createLLMClient = createLLMProvider

export type { LLMProvider }
