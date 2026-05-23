import express, { Request, Response } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { router } from './routes/index'
import { streamRouter } from './routes/stream'
import { errorHandler } from './middleware/error-handler'

export const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api', router)
app.use('/stream', streamRouter)

// 404 — after all routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' })
})

// Error handler — must be last
app.use(errorHandler)
