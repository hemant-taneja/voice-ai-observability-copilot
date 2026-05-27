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

    // Ensure location row exists — preserve OAuth tokens if already present
    await client.query(
      `INSERT INTO locations (location_id, name) VALUES ($1, 'Demo Agency')
       ON CONFLICT (location_id) DO UPDATE SET name = 'Demo Agency'`,
      [LOCATION_ID]
    )

    // Clear existing agent data for this location (cascades to transcripts + analyses)
    await client.query('DELETE FROM agents WHERE location_id = $1', [LOCATION_ID])

    // ── Agents ────────────────────────────────────────────────
    const agents = [
      {
        ghl_agent_id: 'ghl-ag-1',
        name: 'Aria — Travel Booking Specialist',
        script: 'Confirm travel destination and dates. Offer the flight + hotel bundle package. Secure booking commitment and payment intent before ending the call.',
      },
      {
        ghl_agent_id: 'ghl-ag-2',
        name: 'Marcus — FlowCRM Sales Specialist',
        script: 'Lead with discovery questions to uncover the prospect\'s operational pain. Present FlowCRM pipeline automation as the solution. Always close for a 14-day free trial or a scheduled demo call.',
      },
      {
        ghl_agent_id: 'ghl-ag-3',
        name: 'Sophie — Dental Care Coordinator',
        script: 'Book new patient appointments using the $99 special. Verify insurance in-network status — approved carriers: Delta Dental, Cigna, Aetna, MetLife. Address cost concerns. Always confirm callback number before closing.',
      },
    ]

    const agentIds: string[] = []
    for (const a of agents) {
      const r = await client.query(
        `INSERT INTO agents (location_id, ghl_agent_id, name, script) VALUES ($1, $2, $3, $4)
         ON CONFLICT (location_id, ghl_agent_id) DO UPDATE SET name = $3, script = $4
         RETURNING id`,
        [LOCATION_ID, a.ghl_agent_id, a.name, a.script]
      )
      agentIds.push(r.rows[0].id)
    }

    // ── KPI Configs ───────────────────────────────────────────
    const kpiGoals = [
      // ghl-ag-1: Travel Booking
      [
        { name: 'Confirm Destination & Dates', description: 'Get specific travel destination and dates from the prospect', weight: 0.4 },
        { name: 'Present Bundle Upsell', description: 'Proactively offer the flight + hotel bundle package', weight: 0.3 },
        { name: 'Secure Booking Commitment', description: 'Prospect agrees to book or proceeds to payment', weight: 0.3 },
      ],
      // ghl-ag-2: FlowCRM Sales
      [
        { name: 'Uncover Pain Point', description: 'Identify the prospect\'s specific operational problem', weight: 0.3 },
        { name: 'Present Product Fit', description: 'Connect FlowCRM features directly to the stated pain point', weight: 0.4 },
        { name: 'Close for Trial or Demo', description: 'Secure a 14-day free trial signup or a demo call booking', weight: 0.3 },
      ],
      // ghl-ag-3: Dental Care
      [
        { name: 'Book Appointment', description: 'Confirm a specific date and time for the new patient visit', weight: 0.5 },
        { name: 'Verify Insurance Correctly', description: 'Only confirm in-network if carrier is Delta Dental, Cigna, Aetna, or MetLife', weight: 0.3 },
        { name: 'Confirm Callback Number', description: 'Explicitly ask "Is this the best number to reach you?" before closing', weight: 0.2 },
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

    // ── Sample Analyzed Calls ─────────────────────────────────
    // One historical call per agent showing the dashboard populated
    const sampleData = [

      // ── Aria: PASS — Bali anniversary trip booked ──────────
      {
        agentIdx: 0, callId: 'seed-001', phone: '+14155552671', duration: 210,
        turns: [
          { speaker: 'agent', text: 'Hi, this is Aria from Wanderlust Travel. Am I speaking with Priya?', timestamp_ms: 0 },
          { speaker: 'user',  text: 'Yes, this is Priya.', timestamp_ms: 2200 },
          { speaker: 'agent', text: 'Hi Priya! I saw you submitted a travel inquiry. Where are you thinking of going?', timestamp_ms: 3800 },
          { speaker: 'user',  text: 'We are thinking Bali. My husband and I are celebrating our anniversary in March.', timestamp_ms: 7100 },
          { speaker: 'agent', text: 'Bali is a perfect anniversary destination! Do you have specific dates in mind?', timestamp_ms: 11200 },
          { speaker: 'user',  text: 'We are looking at March 15th through the 22nd — about a week.', timestamp_ms: 14500 },
          { speaker: 'agent', text: 'March 15 to 22, 7 nights — noted. Would a complete package with flights and resort interest you? Less to manage.', timestamp_ms: 17800 },
          { speaker: 'user',  text: 'A package sounds great, actually.', timestamp_ms: 23200 },
          { speaker: 'agent', text: 'Perfect. I would recommend our Bali Bliss Bundle — round-trip flights, 7 nights at the Ubud Jungle Resort, daily breakfast, and airport transfers. It is our most popular couples package.', timestamp_ms: 25000 },
          { speaker: 'user',  text: 'That sounds incredible. Let us do it.', timestamp_ms: 32100 },
          { speaker: 'agent', text: 'Excellent! I will lock in availability for March 15 to 22 for two. I will need a $500 deposit to hold the booking. Can I take your card details now?', timestamp_ms: 34500 },
          { speaker: 'user',  text: 'Yes, absolutely. Let me grab my card.', timestamp_ms: 40200 },
        ],
        passed: true,
        score: 0.93,
        summary: 'Aria confirmed destination (Bali) and dates (Mar 15–22), proactively recommended the Bali Bliss Bundle couples package, and secured a booking deposit commitment on the call.',
        kpiScores: [
          { goal: 'Confirm Destination & Dates', score: 0.98, weight: 0.4, passed: true },
          { goal: 'Present Bundle Upsell',       score: 0.95, weight: 0.3, passed: true },
          { goal: 'Secure Booking Commitment',   score: 0.85, weight: 0.3, passed: true },
        ],
        useActions: [],
      },

      // ── Marcus: PASS — FlowCRM trial secured ───────────────
      {
        agentIdx: 1, callId: 'seed-002', phone: '+13105557723', duration: 198,
        turns: [
          { speaker: 'agent', text: 'Hi, this is Marcus from FlowCRM. Am I speaking with Rachel?', timestamp_ms: 0 },
          { speaker: 'user',  text: 'Yes, that is me.', timestamp_ms: 2100 },
          { speaker: 'agent', text: 'Hi Rachel! Quick question — what does your current lead management process look like today?', timestamp_ms: 3700 },
          { speaker: 'user',  text: 'Honestly it is a mess. We use spreadsheets and my reps keep dropping follow-ups. We probably lost three deals last month because nobody followed up in time.', timestamp_ms: 7300 },
          { speaker: 'agent', text: 'So if I am hearing you right — it is not a lack of leads, it is follow-up consistency and visibility into where things stand?', timestamp_ms: 13800 },
          { speaker: 'user',  text: 'Exactly. I have no idea which rep is working which lead unless I physically ask them.', timestamp_ms: 18200 },
          { speaker: 'agent', text: 'That is precisely the problem FlowCRM was built to solve. Our pipeline automation assigns leads automatically, sets follow-up reminders at defined intervals, and gives you a real-time dashboard showing every deal — so you are never in the dark.', timestamp_ms: 20500 },
          { speaker: 'user',  text: 'That sounds exactly like what we need. How much does it cost?', timestamp_ms: 28700 },
          { speaker: 'agent', text: 'Plans start at $49 per user per month. But before committing, why not try it free for 14 days — no credit card required? You could have your team set up by end of this week.', timestamp_ms: 31200 },
          { speaker: 'user',  text: 'That sounds easy. Yes, let us do the trial.', timestamp_ms: 38600 },
          { speaker: 'agent', text: 'Perfect! I will send the signup link to your email right now. You will be running in about 10 minutes.', timestamp_ms: 40800 },
        ],
        passed: true,
        score: 0.92,
        summary: 'Marcus uncovered a clear pain (missed follow-ups, no pipeline visibility), connected FlowCRM\'s automation directly to the stated problem, and closed with a 14-day free trial — no credit card required.',
        kpiScores: [
          { goal: 'Uncover Pain Point',    score: 0.95, weight: 0.3, passed: true },
          { goal: 'Present Product Fit',   score: 0.92, weight: 0.4, passed: true },
          { goal: 'Close for Trial or Demo', score: 0.88, weight: 0.3, passed: true },
        ],
        useActions: [],
      },

      // ── Sophie: PARTIAL — Booked but Humana false positive + no callback ─
      {
        agentIdx: 2, callId: 'seed-003', phone: '+17025559981', duration: 165,
        turns: [
          { speaker: 'agent', text: 'Hi, this is Sophie from Bright Smile Dental. Am I speaking with Amy?', timestamp_ms: 0 },
          { speaker: 'user',  text: 'Yes, that is me.', timestamp_ms: 2100 },
          { speaker: 'agent', text: 'Hi Amy! I am calling about our $99 new patient special — comprehensive exam, X-rays, and a professional cleaning. I would love to get you scheduled!', timestamp_ms: 3500 },
          { speaker: 'user',  text: 'That sounds good. I have Humana dental insurance — do you take that?', timestamp_ms: 9200 },
          { speaker: 'agent', text: 'Yes, absolutely — we accept Humana, so you should be fully covered. No out-of-pocket cost at all!', timestamp_ms: 13800 },
          { speaker: 'user',  text: 'Oh perfect, that makes it an easy yes.', timestamp_ms: 18500 },
          { speaker: 'agent', text: 'Wonderful! We have Monday at 11 AM or Wednesday at 2 PM available. Which works better?', timestamp_ms: 20300 },
          { speaker: 'user',  text: 'Monday at 11 AM sounds perfect.', timestamp_ms: 24900 },
          { speaker: 'agent', text: 'You are all set for Monday at 11 AM! We will send a confirmation text. We look forward to seeing you, Amy!', timestamp_ms: 26600 },
        ],
        passed: false,
        score: 0.52,
        summary: 'Sophie booked the appointment but made two script deviations: confirmed Humana as in-network (it is not — approved carriers are Delta Dental, Cigna, Aetna, MetLife), and closed without asking for the callback number.',
        kpiScores: [
          { goal: 'Book Appointment',           score: 0.92, weight: 0.5, passed: true },
          { goal: 'Verify Insurance Correctly',  score: 0.05, weight: 0.3, passed: false },
          { goal: 'Confirm Callback Number',     score: 0.05, weight: 0.2, passed: false },
        ],
        useActions: [
          { type: 'deviation', description: 'Agent confirmed Humana is in-network — Humana is NOT on the approved carrier list (Delta Dental, Cigna, Aetna, MetLife). Patient will arrive expecting coverage that does not exist.', turn: 4 },
          { type: 'missed_opportunity', description: 'Call ended without asking "Is this the best number to reach you?" — a required closing step per script.', turn: 8 },
        ],
      },

    ]

    for (const d of sampleData) {
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
      const ar = await client.query(
        `INSERT INTO analysis_results (transcript_id, kpi_config_id, overall_score, passed, kpi_scores, summary, llm_provider, llm_model, script_suggestions)
         VALUES ($1, $2, $3, $4, $5, $6, 'openai', 'gpt-4o', $7)
         RETURNING id`,
        [tId, kpiConfigIds[d.agentIdx], d.score, d.passed, JSON.stringify(d.kpiScores), d.summary, JSON.stringify([])]
      )
      const aId = ar.rows[0].id

      for (const ua of d.useActions) {
        await client.query(
          `INSERT INTO use_actions (analysis_id, transcript_turn_index, type, description) VALUES ($1, $2, $3, $4)`,
          [aId, ua.turn, ua.type, ua.description]
        )
      }
    }

    await client.query('COMMIT')
    console.log('✓ Seed complete')
    console.log(`  Location : ${LOCATION_ID}`)
    console.log('  Agents   : 3 (Aria, Marcus, Sophie)')
    console.log('  KPI sets : 3')
    console.log('  Calls    : 3 (Aria PASS, Marcus PASS, Sophie PARTIAL)')
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
