import { Router, Request, Response, NextFunction } from 'express'
import { ghlAuth } from '../middleware/ghl-auth'
import { KpiService } from '../services/kpi-service'
import { AppError } from '../middleware/error-handler'
import { db } from '../db/index'

export const kpiRouter = Router()
const kpiService = new KpiService(db)

// GET /api/kpi/:agentId
kpiRouter.get('/:agentId', ghlAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await kpiService.getConfig(req.params.agentId)
    if (!config) throw new AppError('KPI config not found', 404, 'KPI_NOT_FOUND')
    res.json(config)
  } catch (err) { next(err) }
})

// PUT /api/kpi/:agentId
kpiRouter.put('/:agentId', ghlAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { goals, successThreshold } = req.body
    if (!Array.isArray(goals) || typeof successThreshold !== 'number') {
      throw new AppError('Invalid request body', 400, 'INVALID_BODY')
    }
    const config = await kpiService.upsertConfig(req.params.agentId, goals, successThreshold)
    res.json(config)
  } catch (err) { next(err) }
})
