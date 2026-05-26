describe('config', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    delete require.cache[require.resolve('./config')]
  })

  afterAll(() => {
    process.env = originalEnv
  })

  function setValidEnv() {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/voice_copilot'
    process.env.REDIS_URL = 'redis://localhost:6379'
    process.env.TEMPORAL_ADDRESS = 'localhost:7233'
    process.env.GHL_WEBHOOK_SECRET = 'test-secret'
    process.env.LLM_PROVIDER = 'openai'
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.NODE_ENV = 'test'
  }

  it('loads valid config without throwing', () => {
    setValidEnv()
    expect(() => require('./config')).not.toThrow()
  })

  it('throws when DATABASE_URL is missing', () => {
    setValidEnv()
    delete process.env.DATABASE_URL
    expect(() => require('./config')).toThrow()
  })

  it('throws when LLM_PROVIDER is not openai or anthropic', () => {
    setValidEnv()
    process.env.LLM_PROVIDER = 'grok'
    expect(() => require('./config')).toThrow()
  })

  it('throws when GHL_WEBHOOK_SECRET is missing', () => {
    setValidEnv()
    delete process.env.GHL_WEBHOOK_SECRET
    expect(() => require('./config')).toThrow()
  })
})
