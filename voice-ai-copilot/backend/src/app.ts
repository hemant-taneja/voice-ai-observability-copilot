import express, { Request, Response } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { router } from './routes/index'
import { streamRouter } from './routes/stream'
import { kpiRouter } from './routes/kpi'
import { webhookRouter } from './routes/webhooks'
import { agentsRouter } from './routes/agents'
import { oauthRouter } from './routes/oauth'
import { errorHandler } from './middleware/error-handler'
import { sseManager, SSEEvent } from './lib/sse-manager'

export const app = express()

app.use(helmet({
  frameguard: false, // allow GHL to embed in iframe
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'frame-ancestors': ["'self'", 'https://*.gohighlevel.com', 'https://*.leadconnectorhq.com'],
      'script-src': ["'self'", "'unsafe-inline'"], // required for /oauth/installing inline poll script
    },
  },
}))
app.use(cors())

// Webhook routes MUST be registered before express.json() — they use express.raw() for signature verification
app.use('/webhooks', webhookRouter)

// OAuth callback — registered before json middleware to avoid body parsing issues
app.use('/oauth', oauthRouter)

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api', router)
app.use('/stream', streamRouter)
app.use('/api/kpi', kpiRouter)
app.use('/api/agents', agentsRouter)
app.use('/api', oauthRouter)

// Internal-only SSE broadcast — called by the Temporal worker process via HTTP
// since it runs in a separate process and cannot share the in-memory sseManager.
app.post('/internal/broadcast', (req: Request, res: Response) => {
  const remote = req.socket.remoteAddress
  console.log(`[/internal/broadcast] called from ${remote}`, req.body)
  if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') {
    res.status(403).json({ error: 'Forbidden' })
    return
  }
  const { locationId, type, agentId } = req.body as { locationId: string; type: SSEEvent['type']; agentId: string }
  sseManager.broadcast(locationId, { type, agentId })
  res.json({ ok: true })
})

// 404 — after all routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' })
})

// Error handler — must be last
app.use(errorHandler)
