import { Router, Request, Response, NextFunction } from 'express'
import { ghlAuth } from '../middleware/ghl-auth'
import { db } from '../db/index'
import { AppError } from '../middleware/error-handler'

export const agentsRouter = Router()

// GET /api/agents — list all agents with aggregate metrics for the location
agentsRouter.get('/', ghlAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const locationId =
      (req.query.locationId as string) ||
      (req.headers['x-ghl-location'] as string)

    const { rows } = await db.query(
      `SELECT
         a.id, a.ghl_agent_id, a.name, a.script,
         ROUND(
           COUNT(ar.id) FILTER (WHERE ar.passed = true)::numeric /
           NULLIF(COUNT(ar.id), 0), 2
         ) AS pass_rate,
         COUNT(ar.id) AS total_calls,
         COUNT(ua.id) AS open_use_actions
       FROM agents a
       LEFT JOIN transcripts t   ON t.agent_id = a.id
       LEFT JOIN analysis_results ar ON ar.transcript_id = t.id
       LEFT JOIN use_actions ua  ON ua.analysis_id = ar.id
       WHERE a.location_id = $1
       GROUP BY a.id
       ORDER BY a.name`,
      [locationId]
    )
    res.json(rows.map((r) => ({
      id: r.id,
      ghlAgentId: r.ghl_agent_id,
      name: r.name,
      script: r.script,
      passRate: r.pass_rate ? parseFloat(r.pass_rate) : null,
      totalCalls: parseInt(r.total_calls, 10),
      openUseActions: parseInt(r.open_use_actions, 10),
    })))
  } catch (err) { next(err) }
})

// GET /api/agents/:id/analysis — per-agent analysis drill-down
agentsRouter.get('/:id/analysis', ghlAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await db.query(
      `SELECT
         ar.id, ar.overall_score, ar.passed, ar.kpi_scores, ar.summary, ar.analyzed_at,
         t.id AS transcript_id, t.ghl_call_id, t.duration_seconds, t.ingested_at, t.turns,
         COALESCE(
           json_agg(ua ORDER BY ua.transcript_turn_index) FILTER (WHERE ua.id IS NOT NULL),
           '[]'
         ) AS use_actions
       FROM analysis_results ar
       JOIN transcripts t ON t.id = ar.transcript_id
       LEFT JOIN use_actions ua ON ua.analysis_id = ar.id
       WHERE t.agent_id = $1
       GROUP BY ar.id, t.id
       ORDER BY ar.analyzed_at DESC
       LIMIT 50`,
      [req.params.id]
    )
    if (!rows.length) throw new AppError('Agent not found or no analyses yet', 404, 'AGENT_NOT_FOUND')
    res.json(rows)
  } catch (err) { next(err) }
})
