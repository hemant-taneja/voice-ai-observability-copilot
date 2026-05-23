import { Pool } from 'pg'
import { config } from '../config'

const pool = new Pool({ connectionString: config.databaseUrl })

const LOCATION_ID = 'demo-location-001'
const AGENTS = [
  { ghl_id: 'agent-alpha', name: 'Agent Alpha', script: 'You are a booking agent for Sunrise Dental. Your goal is to book new patient appointments, qualify insurance, and handle objections professionally.' },
  { ghl_id: 'agent-beta',  name: 'Agent Beta',  script: 'You are a lead qualification agent for Summit Real Estate. Qualify buyers by budget, timeline, and location preference.' },
  { ghl_id: 'agent-gamma', name: 'Agent Gamma', script: 'You are a follow-up agent for TechPro Services. Re-engage cold leads and book demo calls.' },
]

const KPI_CONFIGS = [
  { goals: [{ name: 'Book Appointment', description: 'Confirm date and time', weight: 0.5 }, { name: 'Qualify Insurance', description: 'Confirm insurance accepted', weight: 0.3 }, { name: 'Handle Objection', description: 'Address at least one concern', weight: 0.2 }], threshold: 0.70 },
  { goals: [{ name: 'Qualify Budget', description: 'Confirm budget range', weight: 0.4 }, { name: 'Confirm Timeline', description: 'Ask about move-in timeline', weight: 0.3 }, { name: 'Location Preference', description: 'Get area preferences', weight: 0.3 }], threshold: 0.65 },
  { goals: [{ name: 'Re-engage Lead', description: 'Get lead interested again', weight: 0.4 }, { name: 'Book Demo Call', description: 'Schedule a demo', weight: 0.6 }], threshold: 0.70 },
]

function randomTurns(passed: boolean): object[] {
  const base = [
    { speaker: 'agent', text: 'Hi there! Am I speaking with the right person?', timestamp_ms: 0 },
    { speaker: 'user',  text: 'Yes, this is them. Who is this?', timestamp_ms: 3000 },
    { speaker: 'agent', text: 'Great! I\'m calling from our office. Do you have a moment?', timestamp_ms: 6000 },
    { speaker: 'user',  text: 'Sure, go ahead.', timestamp_ms: 9000 },
  ]
  if (passed) {
    return [...base,
      { speaker: 'agent', text: 'Wonderful! I can get you scheduled for Tuesday at 2pm — does that work?', timestamp_ms: 12000 },
      { speaker: 'user',  text: 'That works perfectly.', timestamp_ms: 15000 },
      { speaker: 'agent', text: 'Perfect, you\'re all set! We\'ll send a confirmation shortly.', timestamp_ms: 18000 },
    ]
  }
  return [...base,
    { speaker: 'agent', text: 'We have some great options available...', timestamp_ms: 12000 },
    { speaker: 'user',  text: 'Can you call me later? I\'m busy.', timestamp_ms: 15000 },
    { speaker: 'agent', text: 'Of course, have a great day!', timestamp_ms: 18000 },
  ]
}

async function seed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query(
      `INSERT INTO locations (location_id, name) VALUES ($1, $2) ON CONFLICT (location_id) DO NOTHING`,
      [LOCATION_ID, 'Demo Agency']
    )

    for (let i = 0; i < AGENTS.length; i++) {
      const ag = AGENTS[i]
      const kpi = KPI_CONFIGS[i]

      const { rows: [agent] } = await client.query(
        `INSERT INTO agents (location_id, ghl_agent_id, name, script)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (location_id, ghl_agent_id) DO UPDATE SET name = $3, script = $4
         RETURNING id`,
        [LOCATION_ID, ag.ghl_id, ag.name, ag.script]
      )

      const { rows: [kpiRow] } = await client.query(
        `INSERT INTO kpi_configs (agent_id, goals, success_threshold)
         VALUES ($1, $2, $3)
         ON CONFLICT (agent_id) DO UPDATE SET goals = $2, success_threshold = $3, updated_at = NOW()
         RETURNING id`,
        [agent.id, JSON.stringify(kpi.goals), kpi.threshold]
      )

      for (let j = 0; j < 20; j++) {
        const passed = j % 3 !== 0
        const score = passed ? 0.65 + Math.random() * 0.3 : 0.2 + Math.random() * 0.35
        const callId = `call-${ag.ghl_id}-${j.toString().padStart(3, '0')}`

        const { rows: [transcript] } = await client.query(
          `INSERT INTO transcripts (agent_id, location_id, ghl_call_id, duration_seconds, status, turns)
           VALUES ($1, $2, $3, $4, 'analyzed', $5)
           ON CONFLICT (ghl_call_id) DO NOTHING
           RETURNING id`,
          [agent.id, LOCATION_ID, callId, 45 + Math.floor(Math.random() * 90), JSON.stringify(randomTurns(passed))]
        )
        if (!transcript) continue

        const { rows: [analysis] } = await client.query(
          `INSERT INTO analysis_results (transcript_id, kpi_config_id, overall_score, passed, kpi_scores, summary, llm_provider, llm_model)
           VALUES ($1, $2, $3, $4, $5, $6, 'openai', 'gpt-4o') RETURNING id`,
          [
            transcript.id,
            kpiRow.id,
            score.toFixed(2),
            passed,
            JSON.stringify(kpi.goals.map((g: { name: string }) => ({
              goal: g.name, score: (score + (Math.random() - 0.5) * 0.2).toFixed(2),
              passed, evidence: passed ? 'Addressed successfully.' : 'Not addressed in the call.',
            }))),
            passed ? 'Agent performed well against KPI targets.' : 'Agent missed key objectives this call.',
          ]
        )

        if (!passed && j % 4 === 0) {
          await client.query(
            `INSERT INTO use_actions (analysis_id, transcript_turn_index, type, description)
             VALUES ($1, 5, 'missed_opportunity', 'Agent did not attempt to re-book when user said they were busy.')`,
            [analysis.id]
          )
        }
      }
    }

    await client.query('COMMIT')
    console.log('Seed complete — 3 agents, 60 transcripts, analyses, and use actions')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
