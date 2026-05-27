import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '../../../.env') })

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const LOCATION_ID = process.env.SEED_LOCATION_ID ?? 'TJkIaqSqj7jectw2dxRx'

async function seed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Clear existing seed data for this location
    await client.query('DELETE FROM locations WHERE location_id = $1', [LOCATION_ID])

    // Location
    await client.query(
      `INSERT INTO locations (location_id, name) VALUES ($1, 'Demo Agency') ON CONFLICT DO NOTHING`,
      [LOCATION_ID]
    )

    // Agents
    const agents = [
      { ghl_agent_id: 'ghl-ag-1', name: 'Sarah — Appointment Setter', script: 'Focus on booking appointments. Always confirm date and time.' },
      { ghl_agent_id: 'ghl-ag-2', name: 'Mike — Lead Qualifier', script: 'Qualify leads based on budget and timeline.' },
      { ghl_agent_id: 'ghl-ag-3', name: 'Emma — Objection Handler', script: 'Handle objections professionally and pivot to benefits.' },
    ]

    const agentIds: string[] = []
    for (const a of agents) {
      const r = await client.query(
        `INSERT INTO agents (location_id, ghl_agent_id, name, script) VALUES ($1, $2, $3, $4)
         ON CONFLICT (location_id, ghl_agent_id) DO UPDATE SET name = $3
         RETURNING id`,
        [LOCATION_ID, a.ghl_agent_id, a.name, a.script]
      )
      agentIds.push(r.rows[0].id)
    }

    // KPI Configs
    const kpiGoals = [
      [
        { name: 'Book Appointment', description: 'Confirm a specific date and time', weight: 0.6 },
        { name: 'Handle Objection', description: 'Address at least one concern professionally', weight: 0.4 },
      ],
      [
        { name: 'Qualify Budget', description: 'Identify if budget meets threshold', weight: 0.5 },
        { name: 'Get Timeline', description: 'Determine purchase timeline', weight: 0.3 },
        { name: 'Confirm Interest', description: 'Explicit buying intent statement', weight: 0.2 },
      ],
      [
        { name: 'Acknowledge Objection', description: 'Repeat back the concern', weight: 0.3 },
        { name: 'Provide Evidence', description: 'Counter with testimonial or fact', weight: 0.4 },
        { name: 'Pivot to Benefit', description: 'Connect solution to their stated pain', weight: 0.3 },
      ],
    ]

    const kpiConfigIds: string[] = []
    for (let i = 0; i < agentIds.length; i++) {
      const r = await client.query(
        `INSERT INTO kpi_configs (agent_id, goals, success_threshold) VALUES ($1, $2, $3)
         ON CONFLICT (agent_id) DO UPDATE SET goals = $2
         RETURNING id`,
        [agentIds[i], JSON.stringify(kpiGoals[i]), 0.70]
      )
      kpiConfigIds.push(r.rows[0].id)
    }

    // Sample transcripts + analyses
    const sampleData = [
      {
        agentIdx: 0, callId: 'call-001', phone: '+14155552671', duration: 187,
        turns: [
          { speaker: 'agent', text: 'Hi, this is Sarah from Clarity Solutions. Am I speaking with Jordan?', timestamp_ms: 0 },
          { speaker: 'user',  text: 'Yes, this is Jordan.', timestamp_ms: 2100 },
          { speaker: 'agent', text: 'Great! I\'m calling about your inquiry for our coaching program. Do you have a few minutes?', timestamp_ms: 3800 },
          { speaker: 'user',  text: 'Sure, but I\'m not sure if I can afford it right now.', timestamp_ms: 6200 },
          { speaker: 'agent', text: 'I completely understand. Many of our clients had the same concern initially. Can I ask—if cost weren\'t an issue, would this be something you\'d be excited about?', timestamp_ms: 8100 },
          { speaker: 'user',  text: 'Honestly, yes. I really want to grow my business.', timestamp_ms: 12400 },
          { speaker: 'agent', text: 'Perfect. We do have flexible payment options. Would Tuesday at 2 PM or Thursday at 4 PM work for a quick call with our advisor?', timestamp_ms: 14200 },
          { speaker: 'user',  text: 'Thursday at 4 works.', timestamp_ms: 17800 },
          { speaker: 'agent', text: 'Excellent! I\'ve got you down for Thursday at 4 PM. You\'ll get a confirmation email shortly. Looking forward to it!', timestamp_ms: 19100 },
        ],
        passed: true,
        score: 0.88,
        summary: 'Agent successfully handled price objection by pivoting to value, confirmed genuine interest, and booked appointment for Thursday 4 PM.',
        kpiScores: [
          { goal: 'Book Appointment', score: 0.95, weight: 0.6, passed: true },
          { goal: 'Handle Objection', score: 0.78, weight: 0.4, passed: true },
        ],
        useActions: [],
      },
      {
        agentIdx: 0, callId: 'call-002', phone: '+14155558832', duration: 143,
        turns: [
          { speaker: 'agent', text: 'Hi, is this Alex?', timestamp_ms: 0 },
          { speaker: 'user',  text: 'Yeah.', timestamp_ms: 1800 },
          { speaker: 'agent', text: 'This is Sarah from Clarity Solutions. You filled out a form about our business coaching. Are you still interested?', timestamp_ms: 2500 },
          { speaker: 'user',  text: 'I\'m not really sure, I\'ve been really busy.', timestamp_ms: 6200 },
          { speaker: 'agent', text: 'That\'s totally understandable. Our program is actually designed for busy entrepreneurs. Can we schedule a time next week?', timestamp_ms: 8400 },
          { speaker: 'user',  text: 'I\'ll have to check my calendar and get back to you.', timestamp_ms: 12100 },
          { speaker: 'agent', text: 'Of course! I\'ll send you an email you can reply to. Thanks for your time, Alex.', timestamp_ms: 14300 },
        ],
        passed: false,
        score: 0.42,
        summary: 'Agent failed to book appointment. When prospect said they\'d "get back to you", agent did not attempt to secure a specific time slot.',
        kpiScores: [
          { goal: 'Book Appointment', score: 0.15, weight: 0.6, passed: false },
          { goal: 'Handle Objection', score: 0.85, weight: 0.4, passed: true },
        ],
        useActions: [
          { type: 'missed_opportunity', description: 'Prospect was non-committal but agent did not push for a specific meeting time or offer alternatives', turn: 5 },
          { type: 'deviation', description: 'Script requires offering at least two specific time slots before letting prospect leave without booking', turn: 6 },
        ],
      },
      {
        agentIdx: 1, callId: 'call-003', phone: '+13105557723', duration: 234,
        turns: [
          { speaker: 'agent', text: 'Hi, this is Mike. I saw you expressed interest in our growth accelerator. Got a few minutes?', timestamp_ms: 0 },
          { speaker: 'user',  text: 'Yeah, sure.', timestamp_ms: 2400 },
          { speaker: 'agent', text: 'Great. To make sure we\'re a good fit, can I ask—what\'s your monthly marketing budget right now?', timestamp_ms: 3800 },
          { speaker: 'user',  text: 'We\'re spending about $3,000 a month.', timestamp_ms: 7100 },
          { speaker: 'agent', text: 'Perfect, that\'s right in our sweet spot. And are you looking to implement something in the next 30-90 days?', timestamp_ms: 9200 },
          { speaker: 'user',  text: 'Yeah, we need to move quickly. Our competitor just launched something new.', timestamp_ms: 12800 },
          { speaker: 'agent', text: 'That urgency is actually an advantage for you. With competitive pressure, companies that move in the next 30 days see 40% better outcomes. Are you ready to get started?', timestamp_ms: 15400 },
          { speaker: 'user',  text: 'That sounds good. What are the next steps?', timestamp_ms: 20200 },
        ],
        passed: true,
        score: 0.91,
        summary: 'Excellent qualification call. Budget confirmed at $3k/month (above threshold), timeline is 30-90 days with urgency, and prospect expressed explicit buying intent.',
        kpiScores: [
          { goal: 'Qualify Budget', score: 0.95, weight: 0.5, passed: true },
          { goal: 'Get Timeline', score: 0.90, weight: 0.3, passed: true },
          { goal: 'Confirm Interest', score: 0.88, weight: 0.2, passed: true },
        ],
        useActions: [],
      },
      {
        agentIdx: 2, callId: 'call-004', phone: '+17025559981', duration: 198,
        turns: [
          { speaker: 'agent', text: 'Hi, I\'m calling from Peak Performance. You had some concerns about our program?', timestamp_ms: 0 },
          { speaker: 'user',  text: 'Yes, I\'ve heard mixed reviews about coaching programs in general.', timestamp_ms: 3100 },
          { speaker: 'agent', text: 'That\'s a fair concern. What specifically have you heard?', timestamp_ms: 5800 },
          { speaker: 'user',  text: 'That they overpromise and underdeliver.', timestamp_ms: 8400 },
          { speaker: 'agent', text: 'I hear you. Our clients have shared that same concern before joining. One of them, a contractor from Phoenix, was in the same spot. After 90 days he increased revenue by 40%. Would hearing more about how we structured that help?', timestamp_ms: 11100 },
          { speaker: 'user',  text: 'I guess so.', timestamp_ms: 16700 },
          { speaker: 'agent', text: 'The key difference with us is our guarantee—if you don\'t see measurable results in 60 days, you get a full refund. So the risk is completely removed. Does that address your concern?', timestamp_ms: 18300 },
          { speaker: 'user',  text: 'That does make me feel better. What are the details?', timestamp_ms: 23400 },
        ],
        passed: true,
        score: 0.83,
        summary: 'Agent acknowledged the objection, provided a relevant testimonial, and pivoted to the guarantee to remove risk. Prospect moved from skeptical to engaged.',
        kpiScores: [
          { goal: 'Acknowledge Objection', score: 0.92, weight: 0.3, passed: true },
          { goal: 'Provide Evidence', score: 0.85, weight: 0.4, passed: true },
          { goal: 'Pivot to Benefit', score: 0.70, weight: 0.3, passed: true },
        ],
        useActions: [],
      },
    ]

    for (const d of sampleData) {
      // Insert transcript
      const tr = await client.query(
        `INSERT INTO transcripts (agent_id, location_id, ghl_call_id, caller_phone, duration_seconds, turns, raw_payload, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'analyzed')
         ON CONFLICT (ghl_call_id) DO NOTHING
         RETURNING id`,
        [
          agentIds[d.agentIdx],
          LOCATION_ID,
          d.callId,
          d.phone,
          d.duration,
          JSON.stringify(d.turns),
          JSON.stringify({ callId: d.callId }),
        ]
      )
      if (!tr.rows[0]) continue

      const tId = tr.rows[0].id

      // Insert analysis result
      const ar = await client.query(
        `INSERT INTO analysis_results (transcript_id, kpi_config_id, overall_score, passed, kpi_scores, summary, llm_provider, llm_model)
         VALUES ($1, $2, $3, $4, $5, $6, 'openai', 'gpt-4o')
         RETURNING id`,
        [tId, kpiConfigIds[d.agentIdx], d.score, d.passed, JSON.stringify(d.kpiScores), d.summary]
      )
      const aId = ar.rows[0].id

      // Insert use actions
      for (const ua of d.useActions) {
        await client.query(
          `INSERT INTO use_actions (analysis_id, transcript_turn_index, type, description) VALUES ($1, $2, $3, $4)`,
          [aId, ua.turn, ua.type, ua.description]
        )
      }
    }

    await client.query('COMMIT')
    console.log('✓ Seed data inserted successfully')
    console.log(`  Location: ${LOCATION_ID}`)
    console.log('  Agents: 3')
    console.log('  Transcripts: 4 analyzed, 2 pending')
    console.log('  Pass rate: 3/4 (75%)')
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('Seed failed:', e)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
