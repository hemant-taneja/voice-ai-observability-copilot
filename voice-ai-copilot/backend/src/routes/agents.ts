import { Router, Request, Response, NextFunction } from 'express'
import { ghlAuth } from '../middleware/ghl-auth'
import { AgentsService } from '../services/agents-service'
import { AppError } from '../middleware/error-handler'

export const agentsRouter = Router()
const agentsService = new AgentsService()

// GET /api/agents?locationId=...  (locationId injected by ghlAuth)
agentsRouter.get('/', ghlAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const locationId = (req as any).locationId as string
    const agents = await agentsService.listByLocation(locationId)
    res.json(agents)
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
