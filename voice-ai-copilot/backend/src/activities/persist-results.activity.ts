import { db } from '../db/index'
import { AnalysisOutput } from '../types/llm.types'
import { AnalysisJobData } from '../types/analysis.types'

export async function persistResults(
  output: AnalysisOutput & { provider: string; model: string },
  job: AnalysisJobData
): Promise<string> {
  const client = await db.getClient()
  try {
    await client.query('BEGIN')

    // Load KPI config to compute the score deterministically — never trust LLM's overallScore
    const { rows: configRows } = await client.query(
      'SELECT goals, success_threshold FROM kpi_configs WHERE id = $1',
      [job.kpiConfigId]
    )
    const goals: Array<{ name: string; weight: number }> = configRows[0]?.goals ?? []
    const threshold: number = Number(configRows[0]?.success_threshold ?? 0.7)

    const totalWeight = goals.reduce((s, g) => s + g.weight, 0) || 1
    const overallScore = output.kpiScores.reduce((sum, kpi) => {
      const goal = goals.find((g) => g.name === kpi.goal)
      const weight = goal ? goal.weight / totalWeight : 1 / output.kpiScores.length
      return sum + kpi.score * weight
    }, 0)
    const passed = overallScore >= threshold

    const { rows } = await client.query(
      `INSERT INTO analysis_results
         (transcript_id, kpi_config_id, overall_score, passed, kpi_scores, summary, llm_provider, llm_model, script_suggestions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        job.transcriptId,
        job.kpiConfigId,
        Math.min(1, Math.max(0, overallScore)),
        passed,
        JSON.stringify(output.kpiScores),
        output.summary,
        output.provider,
        output.model,
        JSON.stringify(output.scriptSuggestions ?? []),
      ]
    )

    const analysisId = rows[0].id

    // Deterministic ground truth: which actions actually fired during this call.
    // The LLM is *told* to trust this list, but nothing stops it from labelling a
    // fired action "missed" (e.g. when an attempted transfer failed to connect).
    // "missed" means "should have fired but did not" — so an action present here can
    // never be "missed". We enforce that invariant instead of trusting the model.
    const { rows: firedRows } = await client.query(
      'SELECT ghl_action_id, action_type, action_name FROM transcript_actions WHERE transcript_id = $1',
      [job.transcriptId]
    )
    const firedKeys = new Set<string>()
    for (const f of firedRows) {
      if (f.ghl_action_id) firedKeys.add(`id:${f.ghl_action_id}`)
      // Fallback key: GHL's executed-action id need not equal the synced
      // definition's ghl_action_id, so also match on type + name.
      firedKeys.add(`tn:${f.action_type}::${f.action_name}`)
    }

    // Synced action definitions for this agent, so a finding can be linked back to
    // its definition even when the model returns a mangled ghlActionId (it has been
    // seen to copy the literal "[id: unknown]" text). We resolve by id first, then
    // fall back to action_type + name.
    const { rows: defRows } = await client.query(
      `SELECT aa.id, aa.ghl_action_id, aa.action_type, aa.name
         FROM agent_actions aa
         JOIN transcripts t ON t.agent_id = aa.agent_id
        WHERE t.id = $1`,
      [job.transcriptId]
    )
    const defById = new Map<string, any>()
    const defByTypeName = new Map<string, any>()
    for (const d of defRows) {
      if (d.ghl_action_id) defById.set(d.ghl_action_id, d)
      defByTypeName.set(`${d.action_type}::${d.name}`, d)
    }
    // Strip the model's occasional "[id: xxx]" wrapper down to the bare id.
    const cleanId = (raw?: string | null): string | null => {
      if (!raw) return null
      const m = raw.match(/\[id:\s*(.+?)\s*\]/i)
      const v = (m ? m[1] : raw).trim()
      return v && v.toLowerCase() !== 'unknown' ? v : null
    }
    const resolveDef = (af: { ghlActionId?: string | null; actionType: string; actionName: string }) => {
      const id = cleanId(af.ghlActionId)
      return (id && defById.get(id)) || defByTypeName.get(`${af.actionType}::${af.actionName}`) || null
    }
    const didFire = (af: { ghlActionId?: string | null; actionType: string; actionName: string }) => {
      const id = cleanId(af.ghlActionId)
      return (id != null && firedKeys.has(`id:${id}`)) ||
        firedKeys.has(`tn:${af.actionType}::${af.actionName}`)
    }

    for (const ua of output.useActions) {
      await client.query(
        `INSERT INTO use_actions (analysis_id, transcript_turn_index, type, description)
         VALUES ($1, $2, $3, $4)`,
        [analysisId, ua.transcriptTurnIndex, ua.type, ua.description]
      )
    }

    for (const af of output.actionFindings ?? []) {
      // Enforce the invariant: a fired action cannot be "missed". If the model
      // labelled it "missed" anyway (typically a transfer that fired but failed to
      // connect), downgrade to "incorrect" so the finding still surfaces the issue
      // without falsely claiming the action never ran.
      const status = af.status === 'missed' && didFire(af) ? 'incorrect' : af.status
      // Link the finding to its synced definition (by id, then type+name) and store
      // the definition's canonical ghl_action_id rather than the model's raw string.
      const def = resolveDef(af)
      await client.query(
        `INSERT INTO action_findings
           (analysis_id, agent_action_id, ghl_action_id, action_type, action_name,
            transcript_turn_index, status, description, prompt_flaw, suggested_trigger_prompt)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          analysisId,
          def?.id ?? null,
          def?.ghl_action_id ?? cleanId(af.ghlActionId),
          af.actionType,
          af.actionName,
          af.transcriptTurnIndex,
          status,
          af.description,
          af.promptFlaw ?? null,
          af.suggestedTriggerPrompt ?? null,
        ]
      )
    }

    await client.query(
      `UPDATE transcripts SET status = 'analyzed' WHERE id = $1`,
      [job.transcriptId]
    )

    await client.query('COMMIT')
    return analysisId
  } catch (err) {
    await client.query('ROLLBACK')
    await db.query(
      `UPDATE transcripts SET status = 'analysis_failed' WHERE id = $1`,
      [job.transcriptId]
    )
    throw err
  } finally {
    client.release()
  }
}
