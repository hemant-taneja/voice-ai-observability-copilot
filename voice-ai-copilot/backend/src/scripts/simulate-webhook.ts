/**
 * Webhook Simulator
 *
 * Fires a signed GHL call-completed webhook to the local backend,
 * exercising the full pipeline: webhook → Temporal → LLM → SSE.
 *
 * Single shot:
 *   npm run simulate                               # pass case, default agent (ghl-ag-1)
 *   npm run simulate -- <agentGhlId> pass         # specific agent + outcome
 *   npm run simulate -- <agentGhlId> fail
 *   npm run simulate -- <agentGhlId> partial
 *
 * Batch mode (fires all 3 cases for an agent with a 2s stagger):
 *   npm run simulate -- all                        # all 3 cases for default agent
 *   npm run simulate -- ghl-ag-2 all              # all 3 cases for Marcus
 *
 * Env vars:
 *   SIMULATE_LOCATION_ID  — target location  (default: TJkIaqSqj7jectw2dxRx)
 *   SIMULATE_AGENT_ID     — default agent GHL ID (default: ghl-ag-1)
 *
 * Agents (from seed):
 *   ghl-ag-1  Aria — Travel Booking Specialist
 *   ghl-ag-2  Marcus — FlowCRM Sales Specialist
 *   ghl-ag-3  Sophie — Dental Care Coordinator
 */

import crypto from 'crypto'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as http from 'http'

dotenv.config({ path: path.join(__dirname, '../../../.env') })

const WEBHOOK_SECRET = process.env.GHL_WEBHOOK_SECRET ?? ''
const PORT           = process.env.PORT ?? '3000'
const BASE_URL       = `http://localhost:${PORT}`

const ARG1           = process.argv[2]
const ARG2           = process.argv[3]

const DEFAULT_AGENT  = process.env.SIMULATE_AGENT_ID ?? 'ghl-ag-1'
const BATCH_MODE     = ARG1 === 'all' || ARG2 === 'all'
const AGENT_GHL_ID   = (ARG1 === 'all' || !ARG1) ? DEFAULT_AGENT : ARG1
const SCENARIO_TYPE  = BATCH_MODE ? 'all' : ((ARG2 ?? 'pass') as 'pass' | 'fail' | 'partial' | 'random' | 'all')
const LOCATION_ID    = process.env.SIMULATE_LOCATION_ID ?? 'TJkIaqSqj7jectw2dxRx'
const BATCH_DELAY_MS = 2000

type Turn     = { speaker: 'agent' | 'user'; text: string; timestamp_ms: number }
type TestCase = { label: string; outcome: 'pass' | 'fail' | 'partial'; turns: Turn[] }

// ─────────────────────────────────────────────────────────────────────────────
//  ghl-ag-1 | Aria — Travel Booking Specialist
//
//  Script: Confirm destination + dates. Offer flight + hotel bundle.
//          Secure booking commitment and payment intent.
//
//  KPIs:
//    Confirm Destination & Dates  (0.40) — specific destination and dates obtained
//    Present Bundle Upsell        (0.30) — flight + hotel bundle proactively offered
//    Secure Booking Commitment    (0.30) — prospect commits to book / gives payment intent
//
//  Cases:
//    PASS    — Bali anniversary trip: destination + dates confirmed, Bali Bliss Bundle
//              offered and accepted, deposit commitment secured on the call
//    FAIL    — Maldives inquiry: agent is vague, never pins down dates, no bundle
//              mentioned, ends with "someone will call you back" — no booking
//    PARTIAL — Paris couple's trip: destination + dates confirmed, booking committed,
//              DEVIATION: agent recommends Solo Explorer Pass (solo product) for a couple
//              instead of the Couples Getaway Bundle; also fails to collect payment
//              on the call — sends a link instead
// ─────────────────────────────────────────────────────────────────────────────

const CASES: Record<string, TestCase[]> = {

  'ghl-ag-1': [

    // ── PASS ─────────────────────────────────────────────────
    {
      label: 'PASS — Bali anniversary: destination+dates confirmed, bundle upsold, deposit committed',
      outcome: 'pass',
      turns: [
        { speaker: 'agent', text: "Hi, this is Aria from Wanderlust Travel. Am I speaking with Priya?", timestamp_ms: 0 },
        { speaker: 'user',  text: "Yes, this is Priya.", timestamp_ms: 2200 },
        { speaker: 'agent', text: "Hi Priya! I saw you submitted a travel inquiry. I'd love to help you plan your next trip. Where are you thinking of going?", timestamp_ms: 3800 },
        { speaker: 'user',  text: "We're thinking Bali. My husband and I are celebrating our anniversary in March.", timestamp_ms: 7500 },
        { speaker: 'agent', text: "Bali is a perfect anniversary destination! Do you have specific dates in mind?", timestamp_ms: 12100 },
        { speaker: 'user',  text: "We're looking at March 15th through the 22nd — about a week.", timestamp_ms: 15400 },
        { speaker: 'agent', text: "Wonderful — March 15 to 22, 7 nights. That's peak dry season in Bali. Are you just looking at flights, or would a complete package — flights and resort — be of interest?", timestamp_ms: 18700 },
        { speaker: 'user',  text: "A package sounds great, honestly. Less to manage.", timestamp_ms: 25200 },
        { speaker: 'agent', text: "Perfect. I'd recommend our Bali Bliss Bundle — round-trip flights from New York, 7 nights at the Ubud Jungle Resort, daily breakfast, and airport transfers. It's our most popular couples package. We can also add a complimentary sunset dinner this month.", timestamp_ms: 27000 },
        { speaker: 'user',  text: "Oh wow, that sounds incredible. Let's do it.", timestamp_ms: 36800 },
        { speaker: 'agent', text: "Excellent! I'll lock in availability for March 15 to 22 for two. To hold the booking I'll need a $500 deposit. Can I take your card details now?", timestamp_ms: 38600 },
        { speaker: 'user',  text: "Yes, absolutely. Let me grab my card.", timestamp_ms: 44300 },
        { speaker: 'agent', text: "Perfect — you're going to have an incredible anniversary in Bali, Priya!", timestamp_ms: 46100 },
      ],
    },

    // ── FAIL ─────────────────────────────────────────────────
    {
      label: 'FAIL — Maldives: agent vague, no dates, no bundle offered, no booking',
      outcome: 'fail',
      turns: [
        { speaker: 'agent', text: "Hi, is this James? This is Aria from Wanderlust Travel.", timestamp_ms: 0 },
        { speaker: 'user',  text: "Yeah, that's me.", timestamp_ms: 2800 },
        { speaker: 'agent', text: "Hi James! I'm calling about your travel inquiry. What destination were you thinking?", timestamp_ms: 4200 },
        { speaker: 'user',  text: "The Maldives. I've always wanted to go.", timestamp_ms: 7600 },
        { speaker: 'agent', text: "Oh, the Maldives is beautiful. There are a lot of options there.", timestamp_ms: 10900 },
        { speaker: 'user',  text: "Great. So what do you have available? I'm thinking two weeks.", timestamp_ms: 13500 },
        { speaker: 'agent', text: "Two weeks is a good amount of time. It depends on a lot of factors — the time of year, which atoll you prefer, your budget...", timestamp_ms: 17200 },
        { speaker: 'user',  text: "I'm pretty flexible. Can you give me a rough idea?", timestamp_ms: 23100 },
        { speaker: 'agent', text: "It varies quite a bit — could range from $2,000 to $10,000 depending on the resort. I think someone from our Maldives specialist team would be better placed to help you. Can I have them call you back?", timestamp_ms: 26400 },
        { speaker: 'user',  text: "I mean... sure, I guess.", timestamp_ms: 34800 },
        { speaker: 'agent', text: "Great, I'll pass your details along. They'll be in touch soon. Thanks James!", timestamp_ms: 37200 },
        { speaker: 'user',  text: "Okay. Bye.", timestamp_ms: 41500 },
      ],
    },

    // ── PARTIAL ───────────────────────────────────────────────
    {
      label: 'PARTIAL — Paris couple: dates confirmed, booking intent secured, wrong package (Solo not Couples) + no payment collected',
      outcome: 'partial',
      turns: [
        { speaker: 'agent', text: "Hi, this is Aria from Wanderlust Travel. Am I speaking with David?", timestamp_ms: 0 },
        { speaker: 'user',  text: "Yes, hi Aria.", timestamp_ms: 2400 },
        { speaker: 'agent', text: "Hi David! I understand you're planning a trip. What destination did you have in mind?", timestamp_ms: 3900 },
        { speaker: 'user',  text: "Paris. My girlfriend and I are thinking June 10th to the 17th.", timestamp_ms: 7800 },
        { speaker: 'agent', text: "Paris in June is gorgeous — June 10 to 17, 7 nights. Are you both looking for a package deal, flights and hotel together?", timestamp_ms: 12100 },
        { speaker: 'user',  text: "Yes, that would be the easiest.", timestamp_ms: 17300 },
        { speaker: 'agent', text: "Absolutely. For Paris I'd recommend our Solo City Explorer Pass — it includes a round-trip flight and a centrally located boutique hotel. It's very popular and great value.", timestamp_ms: 19100 },
        { speaker: 'user',  text: "Isn't that a solo package? We're traveling as a couple.", timestamp_ms: 25600 },
        { speaker: 'agent', text: "Oh yes, but it works for two — you'd just book two of them. It comes out to a great rate either way.", timestamp_ms: 28900 },
        { speaker: 'user',  text: "Hmm, okay. If you say so. What's the total?", timestamp_ms: 33200 },
        { speaker: 'agent', text: "For two Solo Explorer passes in June, you're looking at about $2,800 each — so $5,600 together.", timestamp_ms: 36500 },
        { speaker: 'user',  text: "That seems fine. How do we proceed?", timestamp_ms: 41800 },
        { speaker: 'agent', text: "I'll send you an email with all the details and a booking link — just fill it out at your convenience!", timestamp_ms: 44200 },
        { speaker: 'user',  text: "Sounds good. Thanks.", timestamp_ms: 49600 },
      ],
    },

  ],


  // ─────────────────────────────────────────────────────────────────────────────
  //  ghl-ag-2 | Marcus — FlowCRM Sales Specialist
  //
  //  Script: Lead with discovery to uncover operational pain. Present FlowCRM
  //          pipeline automation as the solution. Always close for a 14-day
  //          free trial or a scheduled demo call.
  //
  //  KPIs:
  //    Uncover Pain Point     (0.30) — specific operational problem identified
  //    Present Product Fit    (0.40) — FlowCRM features connected to stated pain
  //    Close for Trial/Demo   (0.30) — 14-day free trial or demo call secured
  //
  //  Cases:
  //    PASS    — Spreadsheet chaos: lost follow-ups uncovered, pipeline automation
  //              presented as solution, 14-day free trial (no CC) closed on the call
  //    FAIL    — Feature dump: agent launches into 47-integration pitch with zero
  //              discovery; prospect confused, no connection to pain, no close
  //    PARTIAL — Right discovery, right fit, wrong close: pain found (inconsistent
  //              follow-ups), FlowCRM sequences presented, but agent books "a call
  //              next week" instead of closing for the free trial — prospect was ready
  // ─────────────────────────────────────────────────────────────────────────────

  'ghl-ag-2': [

    // ── PASS ─────────────────────────────────────────────────
    {
      label: 'PASS — Spreadsheet pain uncovered, pipeline automation fit presented, 14-day trial closed',
      outcome: 'pass',
      turns: [
        { speaker: 'agent', text: "Hi, this is Marcus from FlowCRM. Am I speaking with Rachel?", timestamp_ms: 0 },
        { speaker: 'user',  text: "Yes, that's me.", timestamp_ms: 2100 },
        { speaker: 'agent', text: "Hi Rachel! Quick question to start — what does your current lead management process look like today?", timestamp_ms: 3700 },
        { speaker: 'user',  text: "Honestly, it's a mess. We use spreadsheets and my reps keep dropping the ball on follow-ups. We probably lost three deals last month because no one followed up in time.", timestamp_ms: 7400 },
        { speaker: 'agent', text: "That's a really costly problem. So if I'm hearing you right — it's not a lack of leads, it's follow-up consistency and visibility into where things stand?", timestamp_ms: 14200 },
        { speaker: 'user',  text: "Exactly. I have no idea which rep is working which lead unless I physically ask them.", timestamp_ms: 19500 },
        { speaker: 'agent', text: "That is precisely the problem FlowCRM was built to solve. Our pipeline automation assigns leads to reps automatically, sets follow-up reminders at defined intervals, and gives you a real-time dashboard showing every deal's status — so you're never in the dark again.", timestamp_ms: 22100 },
        { speaker: 'user',  text: "That sounds exactly like what we need. How much does it cost?", timestamp_ms: 30800 },
        { speaker: 'agent', text: "Plans start at $49 per user per month. But before you commit to anything, why not try it risk-free? We have a 14-day free trial — no credit card required. You could have your team set up and running by end of this week.", timestamp_ms: 33500 },
        { speaker: 'user',  text: "That sounds easy. Yeah, let's do the trial.", timestamp_ms: 41200 },
        { speaker: 'agent', text: "Perfect! I'll send the signup link to your email right now. You'll be up and running in about 10 minutes.", timestamp_ms: 43600 },
        { speaker: 'user',  text: "Great. Thanks Marcus.", timestamp_ms: 48900 },
      ],
    },

    // ── FAIL ─────────────────────────────────────────────────
    {
      label: 'FAIL — Feature dump with zero discovery; prospect confused, no pain connected, no close',
      outcome: 'fail',
      turns: [
        { speaker: 'agent', text: "Hi, is this Tom? I'm Marcus from FlowCRM.", timestamp_ms: 0 },
        { speaker: 'user',  text: "Yeah, what's this about?", timestamp_ms: 2700 },
        { speaker: 'agent', text: "Hi Tom! I wanted to tell you about FlowCRM — it has 47 native integrations, AI-powered lead scoring, automated drip sequences, a built-in dialer, and our new GPT-based email composer. It's really the all-in-one solution for sales teams.", timestamp_ms: 4300 },
        { speaker: 'user',  text: "I'm not sure what problem you're solving for me.", timestamp_ms: 12800 },
        { speaker: 'agent', text: "Right, so FlowCRM integrates with Salesforce, HubSpot, Gmail, Outlook, Slack — basically everything. And the AI scoring tells you which leads to prioritize.", timestamp_ms: 15200 },
        { speaker: 'user',  text: "We're a five-person team. I don't think we need all that.", timestamp_ms: 22600 },
        { speaker: 'agent', text: "Oh it scales down too! We have plans for small teams starting at $49 per user.", timestamp_ms: 25800 },
        { speaker: 'user',  text: "I don't know... I'm not really seeing why we'd need this. We're doing okay.", timestamp_ms: 29400 },
        { speaker: 'agent', text: "Okay, well if you ever want to chat, feel free to visit flowcrm.io. Thanks for your time Tom.", timestamp_ms: 33100 },
        { speaker: 'user',  text: "Sure. Bye.", timestamp_ms: 37800 },
      ],
    },

    // ── PARTIAL ───────────────────────────────────────────────
    {
      label: 'PARTIAL — Discovery done, fit presented, DEVIATION: closes for a call next week instead of 14-day free trial',
      outcome: 'partial',
      turns: [
        { speaker: 'agent', text: "Hi, this is Marcus from FlowCRM. Is this Natalie?", timestamp_ms: 0 },
        { speaker: 'user',  text: "Yes, speaking.", timestamp_ms: 2300 },
        { speaker: 'agent', text: "Hi Natalie! I saw you checked out our website. I'm curious — what's the biggest friction point in your sales process right now?", timestamp_ms: 3900 },
        { speaker: 'user',  text: "Our reps are totally inconsistent. Some follow up religiously, others let hot leads go cold for a week. It's really frustrating.", timestamp_ms: 8500 },
        { speaker: 'agent', text: "That follow-up inconsistency is a silent revenue killer. What if your CRM automatically sent a follow-up email or SMS to every lead at exactly the right interval — no matter which rep it's assigned to?", timestamp_ms: 14200 },
        { speaker: 'user',  text: "That would honestly solve so much.", timestamp_ms: 21600 },
        { speaker: 'agent', text: "That's exactly what FlowCRM's automated sequence engine does. You set the cadence once, and it fires for every lead, every time — no rep discretion involved.", timestamp_ms: 24100 },
        { speaker: 'user',  text: "Okay, I'm definitely interested. What's the next step?", timestamp_ms: 31800 },
        { speaker: 'agent', text: "Let's schedule a 30-minute call next week where I can walk you through the platform and answer questions from your team. Does Tuesday or Wednesday work?", timestamp_ms: 34500 },
        { speaker: 'user',  text: "Sure, Wednesday works.", timestamp_ms: 41200 },
        { speaker: 'agent', text: "Great, I'll send a calendar invite to your email. Looking forward to it, Natalie!", timestamp_ms: 43700 },
        { speaker: 'user',  text: "Thanks Marcus.", timestamp_ms: 48100 },
      ],
    },

  ],


  // ─────────────────────────────────────────────────────────────────────────────
  //  ghl-ag-3 | Sophie — Dental Care Coordinator
  //
  //  Script: Book new patient appointments for the $99 special. Verify insurance
  //          in-network status — approved carriers: Delta Dental, Cigna, Aetna,
  //          MetLife. Address cost concerns. Always confirm callback number.
  //
  //  KPIs:
  //    Book Appointment           (0.50) — specific date and time confirmed
  //    Verify Insurance Correctly (0.30) — only confirm in-network if carrier is
  //                                        Delta Dental, Cigna, Aetna, or MetLife
  //    Confirm Callback Number    (0.20) — explicitly asks "Is this the best
  //                                        number to reach you?" before closing
  //
  //  Cases:
  //    PASS    — Aetna verified (in-network), Tuesday 2 PM booked, callback confirmed
  //    FAIL    — UnitedHealthcare question stumps agent; agent says "I'll check and
  //              call you back" — call ends without a booking
  //    PARTIAL — DEVIATION 1: agent confirms Humana is in-network (it is NOT);
  //              appointment booked but patient will arrive with wrong coverage
  //              expectation. DEVIATION 2: call closed without asking for callback.
  // ─────────────────────────────────────────────────────────────────────────────

  'ghl-ag-3': [

    // ── PASS ─────────────────────────────────────────────────
    {
      label: 'PASS — Aetna verified in-network, Tuesday 2 PM booked, callback number confirmed',
      outcome: 'pass',
      turns: [
        { speaker: 'agent', text: "Hi, this is Sophie from Bright Smile Dental. Am I speaking with Karen?", timestamp_ms: 0 },
        { speaker: 'user',  text: "Yes, this is Karen.", timestamp_ms: 2100 },
        { speaker: 'agent', text: "Hi Karen! I'm calling about our new patient special — a comprehensive exam, full X-rays, and a professional cleaning for $99. I'd love to get you scheduled. Do you have a few minutes?", timestamp_ms: 3700 },
        { speaker: 'user',  text: "Sure. I've been meaning to find a dentist since I moved here.", timestamp_ms: 10200 },
        { speaker: 'agent', text: "Perfect timing! Can I ask which dental insurance you have? I want to make sure I check your coverage.", timestamp_ms: 13600 },
        { speaker: 'user',  text: "I have Aetna through my work.", timestamp_ms: 17900 },
        { speaker: 'agent', text: "Great news — we're in-network with Aetna, so your out-of-pocket for the $99 special will likely be minimal or even zero depending on your specific plan.", timestamp_ms: 20400 },
        { speaker: 'user',  text: "Oh, that's reassuring. I was worried about hidden costs.", timestamp_ms: 27100 },
        { speaker: 'agent', text: "Totally understandable — no surprises here. The $99 covers everything in that visit. We have Tuesday at 2 PM or Thursday at 11 AM open. Which works better for you?", timestamp_ms: 30500 },
        { speaker: 'user',  text: "Tuesday at 2 PM works perfectly.", timestamp_ms: 37200 },
        { speaker: 'agent', text: "Wonderful! You're confirmed for Tuesday at 2 PM at our downtown location. We'll text you a reminder the day before. And is this the best number to reach you at?", timestamp_ms: 39800 },
        { speaker: 'user',  text: "Yes, this is my cell — best way to reach me.", timestamp_ms: 46300 },
        { speaker: 'agent', text: "Perfect. We look forward to meeting you Tuesday, Karen!", timestamp_ms: 48900 },
      ],
    },

    // ── FAIL ─────────────────────────────────────────────────
    {
      label: 'FAIL — UnitedHealthcare question stumps agent; no answer given, no booking made',
      outcome: 'fail',
      turns: [
        { speaker: 'agent', text: "Hi, this is Sophie from Bright Smile Dental. May I speak with Brian?", timestamp_ms: 0 },
        { speaker: 'user',  text: "Yeah, this is Brian.", timestamp_ms: 2600 },
        { speaker: 'agent', text: "Hi Brian! I'm reaching out about our new patient special — exam, X-rays, and cleaning for $99. Are you currently looking for a new dentist?", timestamp_ms: 4200 },
        { speaker: 'user',  text: "Actually yeah. But my main question is whether you take my insurance — I have UnitedHealthcare Dental.", timestamp_ms: 9800 },
        { speaker: 'agent', text: "Hmm, let me think... Actually I'm not 100% sure whether we're in-network with UnitedHealthcare. I'd have to check with our billing department.", timestamp_ms: 14500 },
        { speaker: 'user',  text: "You don't know your own insurance list?", timestamp_ms: 21300 },
        { speaker: 'agent', text: "I'm sorry, I don't want to give you wrong information. Can I have our billing team call you back with the answer?", timestamp_ms: 23700 },
        { speaker: 'user',  text: "If you don't know that basic thing, I'm not really inspired with confidence. I'll probably just find someone else.", timestamp_ms: 29400 },
        { speaker: 'agent', text: "I completely understand. I'm really sorry I couldn't be more helpful today, Brian.", timestamp_ms: 34200 },
        { speaker: 'user',  text: "Alright. Thanks anyway.", timestamp_ms: 38600 },
      ],
    },

    // ── PARTIAL ───────────────────────────────────────────────
    {
      label: 'PARTIAL — Monday 11 AM booked, DEVIATION 1: Humana falsely confirmed in-network, DEVIATION 2: no callback number asked',
      outcome: 'partial',
      turns: [
        { speaker: 'agent', text: "Hi, this is Sophie from Bright Smile Dental. Am I speaking with Amy?", timestamp_ms: 0 },
        { speaker: 'user',  text: "Yes, that's me.", timestamp_ms: 2100 },
        { speaker: 'agent', text: "Hi Amy! I'm calling about our new patient special — a comprehensive exam, X-rays, and cleaning for $99. I'd love to get you in!", timestamp_ms: 3500 },
        { speaker: 'user',  text: "That sounds good. I have Humana dental insurance — do you take that?", timestamp_ms: 9200 },
        { speaker: 'agent', text: "Yes, absolutely — we accept Humana, so you should be fully covered. No out-of-pocket cost at all!", timestamp_ms: 13800 },
        { speaker: 'user',  text: "Oh perfect, that makes it an easy yes.", timestamp_ms: 18500 },
        { speaker: 'agent', text: "Wonderful! We have Monday at 11 AM or Wednesday at 2 PM available. Which works better for you?", timestamp_ms: 20300 },
        { speaker: 'user',  text: "Monday at 11 AM sounds perfect.", timestamp_ms: 24900 },
        { speaker: 'agent', text: "You are all set for Monday at 11 AM! We will send a confirmation text. We look forward to seeing you, Amy — have a great day!", timestamp_ms: 26600 },
        { speaker: 'user',  text: "Thanks Sophie, see you then!", timestamp_ms: 31200 },
      ],
    },

  ],

}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickCase(agentId: string, type: 'pass' | 'fail' | 'partial' | 'random'): TestCase {
  const pool     = CASES[agentId] ?? CASES['ghl-ag-1']
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
    const req    = http.request(
      {
        hostname: parsed.hostname,
        port:     parsed.port,
        path:     parsed.pathname,
        method:   'POST',
        headers: {
          'content-type':   'application/json',
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main
// ─────────────────────────────────────────────────────────────────────────────

type SendResult = { agentId: string; label: string; outcome: string; callId: string; transcriptId?: string; ok: boolean }

async function sendWebhook(agentId: string, testCase: TestCase): Promise<SendResult> {
  const id      = callId()
  const payload = {
    callId:          id,
    locationId:      LOCATION_ID,
    agentId,
    callerPhone:     `+1${Math.floor(2000000000 + Math.random() * 8000000000)}`,
    durationSeconds: Math.round(testCase.turns[testCase.turns.length - 1].timestamp_ms / 1000) + 10,
    turns:           testCase.turns,
  }

  const body      = JSON.stringify(payload)
  const signature = sign(body)
  const tag       = testCase.outcome === 'pass' ? '✓ PASS' : testCase.outcome === 'fail' ? '✗ FAIL' : '~ PARTIAL'

  console.log(`\n→ [${tag}] ${testCase.label}`)
  console.log(`  Agent: ${agentId}  |  Call ID: ${id}  |  Turns: ${payload.turns.length}  |  Duration: ~${payload.durationSeconds}s`)
  console.log(`  Posting to ${BASE_URL}/webhooks/call-completed …`)

  try {
    const response = await post(`${BASE_URL}/webhooks/call-completed`, body, signature)
    const parsed   = JSON.parse(response)
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
      results.push(await sendWebhook(AGENT_GHL_ID, cases[i]))
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
