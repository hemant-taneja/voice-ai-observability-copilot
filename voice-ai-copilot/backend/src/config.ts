import { z } from 'zod'
import dotenv from 'dotenv'
import path from 'path'

// Only load .env in non-test environments
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') })
}

const schema = z.object({
  databaseUrl: z.string().min(1, 'DATABASE_URL is required'),
  redisUrl: z.string().min(1, 'REDIS_URL is required'),
  temporalAddress: z.string().min(1, 'TEMPORAL_ADDRESS is required'),
  temporalNamespace: z.string().default('default'),
  ghlClientId: z.string().optional(),
  ghlClientSecret: z.string().optional(),
  ghlWebhookSecret: z.string().min(1, 'GHL_WEBHOOK_SECRET is required'),
  llmProvider: z.enum(['openai', 'anthropic', 'groq']),
  openaiApiKey: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  groqApiKey: z.string().optional(),
  port: z.coerce.number().default(3000),
  nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
})

const result = schema.safeParse({
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  temporalAddress: process.env.TEMPORAL_ADDRESS,
  temporalNamespace: process.env.TEMPORAL_NAMESPACE,
  ghlClientId: process.env.GHL_CLIENT_ID,
  ghlClientSecret: process.env.GHL_CLIENT_SECRET,
  ghlWebhookSecret: process.env.GHL_WEBHOOK_SECRET,
  llmProvider: process.env.LLM_PROVIDER,
  openaiApiKey: process.env.OPENAI_API_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  groqApiKey: process.env.GROQ_API_KEY,
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV,
})

if (!result.success) {
  throw new Error(`Config validation failed:\n${result.error.toString()}`)
}

export const config = result.data
export type Config = typeof config
