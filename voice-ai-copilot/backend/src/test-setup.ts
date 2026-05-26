// Runs before every test file in each Jest worker via jest.config setupFiles.
// Sets the minimum env vars required by config.ts (which skips dotenv in test mode).
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/voice_copilot_test'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.TEMPORAL_ADDRESS = 'localhost:7233'
process.env.GHL_WEBHOOK_SECRET = 'test-webhook-secret'
process.env.LLM_PROVIDER = 'openai'
process.env.OPENAI_API_KEY = 'sk-test'
