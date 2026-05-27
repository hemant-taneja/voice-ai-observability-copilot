/**
 * Webhook Simulator
 *
 * Fires a signed GHL call-completed webhook to the local backend,
 * exercising the full pipeline: webhook → Temporal → LLM → SSE.
 *
 * Single shot:
 *   npm run simulate                          # pass case (default)
 *   npm run simulate -- ghl-ag-1 pass        # specific outcome
 *   npm run simulate -- ghl-ag-1 fail
 *   npm run simulate -- ghl-ag-1 partial
 *
 * Batch mode (fires all 3 cases with a short stagger):
 *   npm run simulate -- all                   # all 3 cases for ghl-ag-1
 *
 * Agent IDs: ghl-ag-1
 * Outcome types: pass, fail, partial
 */

import crypto from 'crypto'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as http from 'http'

dotenv.config({ path: path.join(__dirname, '../../../.env') })

const WEBHOOK_SECRET = process.env.GHL_WEBHOOK_SECRET ?? ''
const PORT           = process.env.PORT ?? '3000'
const BASE_URL       = `http://localhost:${PORT}`

const ARG1           = process.argv[2]   // 'all' | agent-id | undefined
const ARG2           = process.argv[3]   // outcome | undefined

const BATCH_MODE     = ARG1 === 'all'
const AGENT_GHL_ID   = BATCH_MODE ? 'ghl-ag-1' : (ARG1 ?? 'ghl-ag-1')
const SCENARIO_TYPE  = (BATCH_MODE ? 'all' : (ARG2 ?? 'pass')) as 'pass' | 'fail' | 'partial' | 'random' | 'all'
const LOCATION_ID    = process.env.SIMULATE_LOCATION_ID ?? 'loc-seed-1'
const BATCH_DELAY_MS = 2000  // stagger between batch sends

type Turn = { speaker: 'agent' | 'user'; text: string; timestamp_ms: number }
type TestCase = { label: string; outcome: 'pass' | 'fail' | 'partial'; turns: Turn[] }

// ─────────────────────────────────────────────────────────────
//  TEST CASES — ghl-ag-1: Sarah, Appointment Setter
//
//  KPI config (from seed):
//    • Book Appointment (0.6) — confirm a specific date and time
//    • Handle Objection  (0.4) — address at least one concern professionally
//  Script: "Focus on booking appointments. Always confirm date and time."
//
//  Three cases:
//    pass    — objection handled correctly, insurance verified, appointment
//              booked, contact number confirmed
//    fail    — agent gives up at first pushback with zero recovery attempt;
//              no booking, no objection handling at all
//    partial — appointment booked but agent falsely confirms Humana is
//              in-network (it isn't: approved list is Delta Dental, Cigna,
//              Aetna, MetLife) and skips the required phone confirmation
//              → LLM should flag both deviations and generate suggestions
// ─────────────────────────────────────────────────────────────

const CASES: Record<string, TestCase[]> = {

  'ghl-ag-1': [

    // ── PASS ───────────────────────────────────────────────────
    // Agent correctly lists in-network insurers, handles cost concern,
    // offers two time slots, gets a firm booking, confirms contact number.
    // Expected LLM: Book Appointment ~0.95, Handle Objection ~0.90 → PASS
    {
      label: 'PASS — Cost objection handled, Delta Dental verified, appointment booked, phone confirmed',
      outcome: 'pass',
      turns: [
        { speaker: 'agent', text: "Hi, this is Sarah calling from Sunrise Dental. Am I speaking with Jordan?", timestamp_ms: 0 },
        { speaker: 'user',  text: "Yes, this is Jordan.", timestamp_ms: 2200 },
        { speaker: 'agent', text: "Great! I'm reaching out because you expressed interest in our new patient special — a comprehensive exam, X-rays, and cleaning for $99. I wanted to get you scheduled.", timestamp_ms: 3800 },
        { speaker: 'user',  text: "That sounds good, but I'm honestly worried about the cost on top of what my insurance covers.", timestamp_ms: 9500 },
        { speaker: 'agent', text: "That's a totally fair concern. The $99 covers everything upfront with no surprises. Could I ask which dental insurance you have? We're in-network with Delta Dental, Cigna, Aetna, and MetLife, so your out-of-pocket is often minimal or even zero.", timestamp_ms: 11300 },
        { speaker: 'user',  text: "I have Delta Dental through my employer.", timestamp_ms: 18200 },
        { speaker: 'agent', text: "Perfect — we're in-network with Delta Dental, so the $99 special would likely be fully or nearly covered by your plan. We have Tuesday at 10 AM or Thursday at 3 PM available. Which works better for you?", timestamp_ms: 20000 },
        { speaker: 'user',  text: "Thursday at 3 PM works great.", timestamp_ms: 26400 },
        { speaker: 'agent', text: "Wonderful! You're confirmed for Thursday at 3 PM at our downtown office. We'll send a reminder text 24 hours before. Is this the number the best way to reach you?", timestamp_ms: 28200 },
        { speaker: 'user',  text: "Yes, that's my cell — perfect.", timestamp_ms: 33600 },
        { speaker: 'agent', text: "You're all set, Jordan. We look forward to seeing you Thursday!", timestamp_ms: 35100 },
      ],
    },

    // ── FAIL ───────────────────────────────────────────────────
    // Agent folds immediately at the first sign of resistance.
    // No attempt to handle the objection, explain the offer, or recover.
    // Expected LLM: Book Appointment ~0.05, Handle Objection ~0.05 → FAIL
    {
      label: 'FAIL — Agent immediately capitulates at first objection with no recovery attempt',
      outcome: 'fail',
      turns: [
        { speaker: 'agent', text: "Hi, is this Michael? I'm Sarah from Sunrise Dental calling about a new patient offer.", timestamp_ms: 0 },
        { speaker: 'user',  text: "I'm really not interested. Please stop calling me.", timestamp_ms: 2900 },
        { speaker: 'agent', text: "Of course — I'm so sorry to bother you. I'll remove you from our list right away. Have a great day!", timestamp_ms: 4700 },
        { speaker: 'user',  text: "Thanks.", timestamp_ms: 8100 },
      ],
    },

    // ── PARTIAL (two script deviations) ───────────────────────
    // Appointment gets booked (KPI 1 partially met) but:
    //   DEVIATION 1 — Agent confirms "we accept Humana" which is NOT on
    //     the approved list (Delta Dental, Cigna, Aetna, MetLife). Patient
    //     will arrive expecting coverage that doesn't exist.
    //   DEVIATION 2 — Agent ends the call without asking "Is this the best
    //     number to reach you?" — a required script closing step.
    // Expected LLM: Book Appointment ~0.65, Handle Objection ~0.25 → PARTIAL
    // Expected USE actions: insurance misinformation, missing phone confirm
    // Expected script suggestions for both deviations
    {
      label: 'PARTIAL — Booking confirmed but agent falsely verified Humana (not in network) and skipped phone confirmation',
      outcome: 'partial',
      turns: [
        { speaker: 'agent', text: "Hi, this is Sarah from Sunrise Dental. Am I speaking with Amy?", timestamp_ms: 0 },
        { speaker: 'user',  text: "Yes, that's me.", timestamp_ms: 2100 },
        { speaker: 'agent', text: "Hi Amy! I'm calling about our new patient special — a comprehensive exam, X-rays, and cleaning for $99. I'd love to get you scheduled.", timestamp_ms: 3500 },
        { speaker: 'user',  text: "Does my insurance cover this? I have Humana and I really don't want to pay out of pocket.", timestamp_ms: 9200 },
        { speaker: 'agent', text: "Yes, absolutely — we accept Humana, so you should be fully covered. No out-of-pocket cost for you!", timestamp_ms: 13800 },
        { speaker: 'user',  text: "Oh great, that makes it an easy yes then.", timestamp_ms: 18500 },
        { speaker: 'agent', text: "Wonderful! We have Monday at 11 AM or Wednesday at 2 PM available. Which works better?", timestamp_ms: 20300 },
        { speaker: 'user',  text: "Monday at 11 AM sounds perfect.", timestamp_ms: 24900 },
        { speaker: 'agent', text: "You're all set for Monday at 11 AM! We'll see you then, Amy — have a great day!", timestamp_ms: 26600 },
      ],
    },

  ],
}

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickCase(agentId: string, type: 'pass' | 'fail' | 'partial' | 'random'): TestCase {
  const pool = CASES[agentId] ?? CASES['ghl-ag-1']
  if (type === 'random') return pickRandom(pool)
  const filtered = pool.filter((c) => c.outcome === type)
  return filtered.length ? pickRandom(filtered) : pickRandom(pool)
}

function callId(): string {
  return `sim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function sign(body: string): string {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')
}

function post(url: string, body: string, signature: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
          'x-ghl-signature': signature,
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => resolve(data))
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ─────────────────────────────────────────────────────────────
//  Main
// ─────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type SendResult = { agentId: string; label: string; outcome: string; callId: string; transcriptId?: string; ok: boolean }

async function sendWebhook(agentId: string, testCase: TestCase): Promise<SendResult> {
  const id = callId()
  const payload = {
    callId: id,
    locationId: LOCATION_ID,
    agentId,
    callerPhone: `+1${Math.floor(2000000000 + Math.random() * 8000000000)}`,
    durationSeconds: Math.round(testCase.turns[testCase.turns.length - 1].timestamp_ms / 1000) + 10,
    turns: testCase.turns,
  }

  const body      = JSON.stringify(payload)
  const signature = sign(body)
  const tag       = testCase.outcome === 'pass' ? '✓ PASS' : testCase.outcome === 'fail' ? '✗ FAIL' : '~ PARTIAL'

  console.log(`\n→ [${tag}] ${testCase.label}`)
  console.log(`  Agent:    ${agentId}  |  Call ID: ${id}  |  Turns: ${payload.turns.length}  |  Duration: ~${payload.durationSeconds}s`)
  console.log(`  Posting to ${BASE_URL}/webhooks/call-completed …`)

  try {
    const response     = await post(`${BASE_URL}/webhooks/call-completed`, body, signature)
    const parsed       = JSON.parse(response)
    if (parsed.received) {
      console.log(`  ✓ Accepted — transcript ID: ${parsed.transcriptId}`)
      return { agentId, label: testCase.label, outcome: testCase.outcome, callId: id, transcriptId: parsed.transcriptId, ok: true }
    }
    console.error('  ✗ Unexpected response:', response)
    return { agentId, label: testCase.label, outcome: testCase.outcome, callId: id, ok: false }
  } catch (err: any) {
    console.error('  ✗ Failed to connect to backend:', err.message)
    return { agentId, label: testCase.label, outcome: testCase.outcome, callId: id, ok: false }
  }
}

async function main() {
  if (BATCH_MODE) {
    const cases = CASES[AGENT_GHL_ID] ?? []
    console.log(`\nBatch mode — ${cases.length} scenarios for agent: ${AGENT_GHL_ID}`)
    console.log(`Location: ${LOCATION_ID}  |  Stagger: ${BATCH_DELAY_MS}ms`)
    console.log('─'.repeat(60))

    const results: SendResult[] = []
    for (let i = 0; i < cases.length; i++) {
      const result = await sendWebhook(AGENT_GHL_ID, cases[i])
      results.push(result)
      if (i < cases.length - 1) await delay(BATCH_DELAY_MS)
    }

    console.log('\n' + '═'.repeat(70))
    console.log('Batch summary:')
    console.log('═'.repeat(70))
    for (const r of results) {
      const status     = r.ok ? '✓' : '✗'
      const outcomeTag = r.outcome === 'pass' ? 'PASS   ' : r.outcome === 'fail' ? 'FAIL   ' : 'PARTIAL'
      const label      = r.label.length > 50 ? r.label.slice(0, 47) + '…' : r.label.padEnd(50)
      console.log(`  ${status} [${outcomeTag}] ${label}`)
    }
    const ok = results.filter((r) => r.ok).length
    console.log(`\n  ${ok}/${results.length} accepted — watch the dashboard or Temporal UI for analysis results.`)

  } else {
    const testCase = pickCase(AGENT_GHL_ID, SCENARIO_TYPE as 'pass' | 'fail' | 'partial' | 'random')
    const result   = await sendWebhook(AGENT_GHL_ID, testCase)
    if (result.ok) {
      console.log('\n  Watch the dashboard or Temporal UI for analysis completion.')
    } else {
      console.error('\n  Make sure the backend is running: npm run dev')
    }
  }
}

main()
