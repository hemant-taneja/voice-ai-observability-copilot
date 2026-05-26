import { Router, Request, Response, NextFunction } from 'express'
import { Client, Connection } from '@temporalio/client'
import { ghlAuth } from '../middleware/ghl-auth'
import { AgentsService } from '../services/agents-service'
import { TranscriptService } from '../services/transcript-service'
import { AppError } from '../middleware/error-handler'
import { config } from '../config'

export const agentsRouter = Router()
const agentsService = new AgentsService()
const transcriptService = new TranscriptService()

let temporalClient: Client | null = null
async function getTemporalClient(): Promise<Client> {
  if (!temporalClient) {
    const connection = await Connection.connect({ address: config.temporalAddress })
    temporalClient = new Client({ connection, namespace: config.temporalNamespace })
  }
  return temporalClient
}

// GET /api/agents?locationId=...  (locationId injected by ghlAuth)
agentsRouter.get('/', ghlAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const locationId = (req as any).locationId as string
    const agents = await agentsService.listByLocation(locationId)
    res.json(agents)
  } catch (err) { next(err) }
})

// GET /api/agents/:agentId/analysis?locationId=...
agentsRouter.get('/:agentId/analysis', ghlAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const locationId = (req as any).locationId as string
    const analyses = await agentsService.getAnalyses(req.params.agentId, locationId)
    res.json(analyses)
  } catch (err) { next(err) }
})

// PUT /api/agents/:agentId  — update agent script/prompt
agentsRouter.put('/:agentId', ghlAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const locationId = (req as any).locationId as string
    const { script } = req.body
    if (typeof script !== 'string') throw new AppError('script must be a string', 400, 'INVALID_BODY')
    await agentsService.updateScript(req.params.agentId, locationId, script)
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// GET /api/agents/:agentId?locationId=...
agentsRouter.get('/:agentId', ghlAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const locationId = (req as any).locationId as string
    const detail = await agentsService.getDetail(req.params.agentId, locationId)
    if (!detail) throw new AppError('Agent not found', 404, 'AGENT_NOT_FOUND')
    res.json(detail)
  } catch (err) { next(err) }
})

// POST /api/agents/:agentId/simulate  — playground: submit a manual transcript for analysis
agentsRouter.post('/:agentId/simulate', ghlAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const locationId = (req as any).locationId as string
    const { agentId } = req.params
    const { turns } = req.body as { turns: Array<{ speaker: 'agent' | 'user'; text: string; timestamp_ms: number }> }

    if (!Array.isArray(turns) || turns.length === 0) {
      throw new AppError('turns must be a non-empty array', 400, 'INVALID_BODY')
    }

    // Look up the ghl_agent_id for this agent (internal UUID → GHL string)
    const agentDetail = await agentsService.getDetail(agentId, locationId)
    if (!agentDetail) throw new AppError('Agent not found', 404, 'AGENT_NOT_FOUND')

    const callId = `playground-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const durationSeconds = Math.round((turns[turns.length - 1].timestamp_ms ?? 0) / 1000) + 5

    const payload = {
      callId,
      locationId,
      agentId: agentDetail.ghlAgentId,
      callerPhone: '+10000000000',
      durationSeconds,
      turns,
    }

    const result = await transcriptService.ingest(payload)

    if (!result.kpiConfigId) {
      throw new AppError('No KPI config for this agent — set one before running analysis', 422, 'NO_KPI_CONFIG')
    }

    const client = await getTemporalClient()
    const workflowId = `analyze-${result.id}`
    await client.workflow.start('analyzeCallWorkflow', {
      taskQueue: 'voice-ai-analysis',
      workflowId,
      args: [{ transcriptId: result.id, agentId: agentDetail.ghlAgentId, locationId, kpiConfigId: result.kpiConfigId }],
    })

    res.json({ ok: true, transcriptId: result.id, workflowId })
  } catch (err) { next(err) }
})

// POST /api/agents/:agentId/transcripts/:transcriptId/reanalyze
agentsRouter.post('/:agentId/transcripts/:transcriptId/reanalyze', ghlAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const locationId = (req as any).locationId as string
    const { agentId, transcriptId } = req.params

    const { kpiConfigId, ghlAgentId } = await agentsService.reanalyzeTranscript(agentId, transcriptId, locationId)

    const client = await getTemporalClient()
    const workflowId = `analyze-${transcriptId}-rerun-${Date.now()}`
    await client.workflow.start('analyzeCallWorkflow', {
      taskQueue: 'voice-ai-analysis',
      workflowId,
      args: [{ transcriptId, agentId: ghlAgentId, locationId, kpiConfigId }],
    })

    res.json({ ok: true, workflowId })
  } catch (err) { next(err) }
})
