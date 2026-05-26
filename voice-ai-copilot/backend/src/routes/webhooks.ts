import express, { Router, Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { Client, Connection } from '@temporalio/client'
import { TranscriptService } from '../services/transcript-service'
import { GHLCallCompletedPayload } from '../types/ghl.types'
import { config } from '../config'
import { AppError } from '../middleware/error-handler'

export const webhookRouter = Router()

// Raw body middleware — must be applied before express.json() in app.ts
webhookRouter.use(express.raw({ type: 'application/json' }))

function verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature) return false
  const expected = crypto
    .createHmac('sha256', config.ghlWebhookSecret)
    .update(rawBody)
    .digest('hex')
  // timingSafeEqual requires equal-length buffers
  if (Buffer.from(expected).length !== Buffer.from(signature).length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

let temporalClient: Client | null = null

async function getTemporalClient(): Promise<Client> {
  if (!temporalClient) {
    const connection = await Connection.connect({ address: config.temporalAddress })
    temporalClient = new Client({ connection, namespace: config.temporalNamespace })
  }
  return temporalClient
}

const transcriptService = new TranscriptService()

webhookRouter.post('/call-completed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawBody = req.body as Buffer
    const signature = req.headers['x-ghl-signature'] as string | undefined

    if (!verifySignature(rawBody, signature)) {
      throw new AppError('Invalid signature', 401, 'INVALID_SIGNATURE')
    }

    const payload: GHLCallCompletedPayload = JSON.parse(rawBody.toString())
    const result = await transcriptService.ingest(payload)

    // Return 200 immediately — GHL should not wait for analysis
    res.json({ received: true, transcriptId: result.id })

    // Enqueue Temporal workflow after response (skip if duplicate or no KPI config)
    if (result.isNew && result.kpiConfigId) {
      const client = await getTemporalClient()
      await client.workflow.start('analyzeCallWorkflow', {
        taskQueue: 'voice-ai-analysis',
        workflowId: `analyze-${result.id}`,
        args: [{
          transcriptId: result.id,
          agentId: payload.agentId,
          locationId: payload.locationId,
          kpiConfigId: result.kpiConfigId,
        }],
      })
    }
  } catch (err) { next(err) }
})
