import { Router, Request, Response, NextFunction } from 'express'
import { ghlAuth } from '../middleware/ghl-auth'
import { KpiService } from '../services/kpi-service'
import { AppError } from '../middleware/error-handler'
import { createLLMProvider } from '../lib/llm/index'
import { db } from '../db/index'

export const kpiRouter = Router()
const kpiService = new KpiService()

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

// POST /api/kpi/:agentId/suggest  — derive KPI goals from the agent's script via LLM
kpiRouter.post('/:agentId/suggest', ghlAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await db.query(
      'SELECT script FROM agents WHERE id = $1',
      [req.params.agentId]
    )
    const script: string = rows[0]?.script
    if (!script) throw new AppError('Agent has no script set', 422, 'NO_SCRIPT')

    const llm = createLLMProvider()
    const goals = await llm.suggestKpiGoals(script)
    res.json({ goals })
  } catch (err) { next(err) }
})
