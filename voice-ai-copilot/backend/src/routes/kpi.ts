import { Router } from 'express'
import { KpiService } from '../services/kpi-service'
import { AppError } from '../middleware/error-handler'

const router = Router()
const kpiService = new KpiService()

// GET /api/kpi/:agentId
router.get('/:agentId', async (req, res, next) => {
  try {
    const config = await kpiService.getConfig(req.params.agentId)
    if (!config) throw new AppError('KPI config not found', 404, 'NOT_FOUND')
    res.json(config)
  } catch (err) {
    next(err)
  }
})

// PUT /api/kpi/:agentId
router.put('/:agentId', async (req, res, next) => {
  try {
    const { goals, passThreshold } = req.body
    if (!Array.isArray(goals) || typeof passThreshold !== 'number') {
      throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR')
    }
    await kpiService.upsertConfig(req.params.agentId, goals, passThreshold)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
