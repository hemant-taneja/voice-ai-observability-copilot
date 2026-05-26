import { Router, Request, Response } from 'express'
import { ghlAuth } from '../middleware/ghl-auth'
import { sseManager } from '../lib/sse-manager'

export const streamRouter = Router()

streamRouter.get('/', ghlAuth(), (req: Request, res: Response) => {
  const locationId = req.query.locationId as string

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  res.write(`data: ${JSON.stringify({ type: 'connected', locationId })}\n\n`)

  sseManager.add(locationId, res)
  console.log(`[SSE] client connected locationId=${locationId}`)

  // Keepalive: send SSE comment every 15 s to prevent proxy/browser timeout
  const heartbeat = setInterval(() => {
    res.write(': keep-alive\n\n')
  }, 15_000)

  req.on('close', () => {
    clearInterval(heartbeat)
    sseManager.remove(locationId, res)
    console.log(`[SSE] client disconnected locationId=${locationId}`)
  })
})
