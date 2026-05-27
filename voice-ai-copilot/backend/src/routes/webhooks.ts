import express, { Router, Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import axios from 'axios'
import { Client, Connection } from '@temporalio/client'
import { TranscriptService } from '../services/transcript-service'
import {
  GHLCallCompletedPayload,
  VoiceAiCallEndPayload,
  AppInstallPayload,
  AppUninstallPayload,
} from '../types/ghl.types'
import { config } from '../config'
import { AppError } from '../middleware/error-handler'
import { db } from '../db/index'

export const webhookRouter = Router()

// ── GHL Ed25519 public key for marketplace webhook signature verification ──
// This is GHL's PUBLIC key — published in their docs, not a secret.
// Override via GHL_WEBHOOK_PUBLIC_KEY env var if GHL rotates the key without a deploy.
const GHL_ED25519_PUBLIC_KEY = process.env.GHL_WEBHOOK_PUBLIC_KEY ?? `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
-----END PUBLIC KEY-----`

const GHL_BASE = 'https://services.leadconnectorhq.com'

// Raw body middleware — must be applied before express.json() in app.ts
webhookRouter.use(express.raw({ type: 'application/json' }))

// HMAC-SHA256 verification for the private /call-completed endpoint
function verifyHmac(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature) return false
  const expected = crypto
    .createHmac('sha256', config.ghlWebhookSecret)
    .update(rawBody)
    .digest('hex')
  if (Buffer.from(expected).length !== Buffer.from(signature).length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

// Ed25519 verification for GHL marketplace webhooks
function verifyEd25519(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature) return false
  try {
    return crypto.verify(
      null,
      rawBody,
      GHL_ED25519_PUBLIC_KEY,
      Buffer.from(signature, 'base64')
    )
  } catch {
    return false
  }
}

// Parse a GHL VoiceAiCallEnd transcript string into structured turns.
// GHL format: "AI Agent: <text>\nCaller: <text>\n..."
function parseTranscriptToTurns(
  transcript: string
): Array<{ speaker: 'agent' | 'user'; text: string; timestamp_ms: number }> {
  const lines = transcript.split('\n').filter(l => l.trim())
  const turns: Array<{ speaker: 'agent' | 'user'; text: string; timestamp_ms: number }> = []

  for (const line of lines) {
    const agentMatch = line.match(/^(?:AI Agent|Agent):\s*(.+)/i)
    const userMatch  = line.match(/^(?:Caller|User|Customer):\s*(.+)/i)

    if (agentMatch) {
      turns.push({ speaker: 'agent', text: agentMatch[1].trim(), timestamp_ms: 0 })
    } else if (userMatch) {
      turns.push({ speaker: 'user', text: userMatch[1].trim(), timestamp_ms: 0 })
    } else if (turns.length > 0) {
      // Continuation line — append to the last turn
      turns[turns.length - 1].text += ' ' + line.trim()
    }
  }

  // Fall back to a single agent turn if parsing produced nothing
  if (!turns.length && transcript.trim()) {
    turns.push({ speaker: 'agent', text: transcript.trim(), timestamp_ms: 0 })
  }

  return turns
}

async function mintAndStoreLocationToken(
  companyId: string,
  locationId: string
): Promise<void> {
  const { rows } = await db.query<{ access_token: string; refresh_token: string; token_expires_at: Date | null }>(
    'SELECT access_token, refresh_token, token_expires_at FROM locations WHERE location_id = $1',
    [`company:${companyId}`]
  )
  if (!rows[0]) return // No agency token stored yet — skip

  const agencyToken = rows[0].access_token

  const { data } = await axios.post(
    `${GHL_BASE}/oauth/locationToken`,
    { companyId, locationId },
    { headers: { Authorization: `Bearer ${agencyToken}`, Version: '2021-07-28', Accept: 'application/json' } }
  )

  const expiresAt = new Date(Date.now() + data.expires_in * 1000)
  await db.query(
    `INSERT INTO locations (location_id, company_id, access_token, refresh_token, token_expires_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (location_id) DO UPDATE
     SET company_id       = EXCLUDED.company_id,
         access_token     = EXCLUDED.access_token,
         refresh_token    = EXCLUDED.refresh_token,
         token_expires_at = EXCLUDED.token_expires_at`,
    [locationId, companyId, data.access_token, data.refresh_token ?? null, expiresAt]
  )
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

    if (!verifyHmac(rawBody, signature)) {
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

/**
 * POST /webhooks/ghl
 *
 * Unified GHL marketplace webhook endpoint — receives all events configured
 * in the app's Advanced Settings > Webhooks panel.
 *
 * Signature: Ed25519 via X-GHL-Signature header (GHL's hardcoded public key).
 * Set this URL in GHL marketplace app settings as the Webhook URL.
 */
webhookRouter.post('/ghl', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawBody = req.body as Buffer
    const signature = req.headers['x-ghl-signature'] as string | undefined

    if (!verifyEd25519(rawBody, signature)) {
      throw new AppError('Invalid signature', 401, 'INVALID_SIGNATURE')
    }

    const payload = JSON.parse(rawBody.toString()) as { type: string; [key: string]: unknown }

    // Acknowledge immediately — all processing is async
    res.json({ received: true })

    switch (payload.type) {
      case 'INSTALL': {
        const event = payload as unknown as AppInstallPayload
        if (event.locationId && event.companyId) {
          await mintAndStoreLocationToken(event.companyId, event.locationId).catch(err =>
            console.error('[AppInstall] Failed to mint location token:', err)
          )
        }
        break
      }

      case 'UNINSTALL': {
        const event = payload as unknown as AppUninstallPayload
        if (event.locationId) {
          await db.query(
            'DELETE FROM locations WHERE location_id = $1',
            [event.locationId]
          )
        }
        break
      }

      case 'VoiceAiCallEnd': {
        const event = payload as unknown as VoiceAiCallEndPayload
        const turns = parseTranscriptToTurns(event.transcript ?? '')

        const adapted: GHLCallCompletedPayload = {
          callId:          event.id,
          locationId:      event.locationId,
          agentId:         event.agentId,
          callerPhone:     event.fromNumber,
          durationSeconds: event.duration,
          turns,
        }

        const result = await transcriptService.ingest(adapted)

        if (result.isNew && result.kpiConfigId) {
          const client = await getTemporalClient()
          await client.workflow.start('analyzeCallWorkflow', {
            taskQueue: 'voice-ai-analysis',
            workflowId: `analyze-${result.id}`,
            args: [{
              transcriptId: result.id,
              agentId:      event.agentId,
              locationId:   event.locationId,
              kpiConfigId:  result.kpiConfigId,
            }],
          })
        }
        break
      }

      default:
        // Unhandled event type — log and ignore
        console.log(`[webhook/ghl] unhandled event type: ${payload.type}`)
    }
  } catch (err) { next(err) }
})
