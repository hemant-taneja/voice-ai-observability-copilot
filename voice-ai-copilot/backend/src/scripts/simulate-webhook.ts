/**
 * Webhook Simulator
 *
 * Fires a signed GHL call-completed webhook to the local backend,
 * exercising the full pipeline: webhook → Temporal → LLM → SSE.
 *
 * Single shot:
 *   npm run simulate                          # random agent, random scenario
 *   npm run simulate -- agent-alpha           # specific agent, random scenario
 *   npm run simulate -- agent-alpha pass      # specific agent, specific outcome
 *
 * Batch mode (fires every scenario with a short stagger):
 *   npm run simulate -- all                   # all scenarios for all agents
 *   npm run simulate -- all agent-alpha       # all scenarios for one agent
 *
 * Agent IDs: agent-alpha, agent-beta, agent-gamma
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
const ARG2           = process.argv[3]   // agent-id (when arg1=all) | outcome | undefined

const BATCH_MODE     = ARG1 === 'all'
const AGENT_GHL_ID   = BATCH_MODE
  ? (ARG2 ?? 'all')
  : (ARG1 ?? pickRandom(['agent-alpha', 'agent-beta', 'agent-gamma']))
const SCENARIO_TYPE  = (BATCH_MODE ? 'all' : (ARG2 ?? 'random')) as 'pass' | 'fail' | 'partial' | 'random' | 'all'
const LOCATION_ID    = 'demo-location-001'
const BATCH_DELAY_MS = 1500  // stagger between batch sends

type Turn = { speaker: 'agent' | 'user'; text: string; timestamp_ms: number }
type TestCase = { label: string; outcome: 'pass' | 'fail' | 'partial'; turns: Turn[] }

// ─────────────────────────────────────────────────────────────
//  TEST CASES PER AGENT
// ─────────────────────────────────────────────────────────────

const CASES: Record<string, TestCase[]> = {

  // ── Sunrise Dental Booker ──────────────────────────────────
  'agent-alpha': [
    {
      label: 'PASS — New patient booked, insurance confirmed',
      outcome: 'pass',
      turns: [
        { speaker: 'agent', text: "Hi, this is Sarah calling from Sunrise Dental. Am I speaking with Michael today?", timestamp_ms: 0 },
        { speaker: 'user',  text: "Yes, this is Michael.", timestamp_ms: 2200 },
        { speaker: 'agent', text: "Great! I'm reaching out because you expressed interest in our new patient special — a comprehensive exam, X-rays, and cleaning for $99. We're currently accepting new patients and I wanted to get you scheduled.", timestamp_ms: 3800 },
        { speaker: 'user',  text: "Oh right, yeah I did see that. I've been meaning to find a new dentist.", timestamp_ms: 9500 },
        { speaker: 'agent', text: "Perfect timing then! Before we lock in a time, could you let me know which dental insurance you have? We accept Delta Dental, Cigna, Aetna, MetLife, and most major plans.", timestamp_ms: 11200 },
        { speaker: 'user',  text: "I have Delta Dental through my employer.", timestamp_ms: 16800 },
        { speaker: 'agent', text: "Excellent, we're in-network with Delta Dental so you'll have great coverage. We have openings on Tuesday at 9 AM or Thursday at 3 PM — which works better for you?", timestamp_ms: 18500 },
        { speaker: 'user',  text: "Thursday at 3 works for me.", timestamp_ms: 23400 },
        { speaker: 'agent', text: "Perfect! I've got you down for Thursday at 3 PM at our downtown office. We'll send a confirmation text and a reminder 24 hours before. Is the number I'm calling you on the best to reach you?", timestamp_ms: 25100 },
        { speaker: 'user',  text: "Yes, that's my cell.", timestamp_ms: 30200 },
        { speaker: 'agent', text: "Great, you're all set Michael. We look forward to seeing you Thursday!", timestamp_ms: 31800 },
      ],
    },
    {
      label: 'PASS — Objection about cost handled, appointment booked',
      outcome: 'pass',
      turns: [
        { speaker: 'agent', text: "Hi, this is Jessica from Sunrise Dental. Am I speaking with Amy?", timestamp_ms: 0 },
        { speaker: 'user',  text: "Yes.", timestamp_ms: 1800 },
        { speaker: 'agent', text: "Hi Amy! I'm calling because you filled out a form about our new patient special — a comprehensive exam, X-rays, and cleaning for $99. I wanted to get you scheduled.", timestamp_ms: 3000 },
        { speaker: 'user',  text: "I'm not sure I can afford dental care right now honestly.", timestamp_ms: 8900 },
        { speaker: 'agent', text: "Completely understand. That's exactly why we created the $99 new patient special — it covers everything upfront with no surprises. And if you have insurance, it may cover part or all of it.", timestamp_ms: 10700 },
        { speaker: 'user',  text: "I actually have Cigna through work.", timestamp_ms: 17200 },
        { speaker: 'agent', text: "Perfect, we're in-network with Cigna. Your out-of-pocket would likely be minimal or zero. We have Monday at 10 AM or Wednesday at 2 PM available. Which would you prefer?", timestamp_ms: 18900 },
        { speaker: 'user',  text: "Monday at 10 sounds good.", timestamp_ms: 25100 },
        { speaker: 'agent', text: "Wonderful! You're booked for Monday at 10 AM. We'll send you a confirmation and reminder. Is this the best number for you?", timestamp_ms: 27000 },
        { speaker: 'user',  text: "Yes, perfect.", timestamp_ms: 32300 },
      ],
    },
    {
      label: 'FAIL — Patient not booked, insurance not qualified',
      outcome: 'fail',
      turns: [
        { speaker: 'agent', text: "Hi, I'm calling from Sunrise Dental about the new patient offer.", timestamp_ms: 0 },
        { speaker: 'user',  text: "Oh, I'm kind of busy right now.", timestamp_ms: 2800 },
        { speaker: 'agent', text: "I understand. I just wanted to let you know about our $99 special.", timestamp_ms: 4500 },
        { speaker: 'user',  text: "Can you call me back another time?", timestamp_ms: 7900 },
        { speaker: 'agent', text: "Of course, no problem. I'll try you again later. Have a great day!", timestamp_ms: 9600 },
        { speaker: 'user',  text: "Thanks, bye.", timestamp_ms: 12100 },
      ],
    },
    {
      label: 'PARTIAL — Insurance confirmed but open time slot not offered (missed opportunity)',
      outcome: 'partial',
      turns: [
        { speaker: 'agent', text: "Hi, calling from Sunrise Dental. Is this Tom?", timestamp_ms: 0 },
        { speaker: 'user',  text: "Yeah, speaking.", timestamp_ms: 2100 },
        { speaker: 'agent', text: "Hi Tom! I'm reaching out about our new patient special — $99 for a full exam, X-rays, and cleaning.", timestamp_ms: 3600 },
        { speaker: 'user',  text: "That sounds decent. I do need to find a dentist.", timestamp_ms: 8400 },
        { speaker: 'agent', text: "Great! Do you have dental insurance?", timestamp_ms: 10200 },
        { speaker: 'user',  text: "I have Aetna.", timestamp_ms: 12900 },
        { speaker: 'agent', text: "We accept Aetna, great. So just give us a call back when you're ready to schedule and we can get you in.", timestamp_ms: 14600 },
        { speaker: 'user',  text: "Okay, I'll do that.", timestamp_ms: 20100 },
        { speaker: 'agent', text: "Sounds great, have a good one!", timestamp_ms: 21800 },
      ],
    },
    {
      label: 'PARTIAL — Appointment booked but insurance never qualified (missed opportunity)',
      outcome: 'partial',
      turns: [
        { speaker: 'agent', text: "Hi, this is Sarah from Sunrise Dental. Am I speaking with Rachel?", timestamp_ms: 0 },
        { speaker: 'user',  text: "Yes, that's me.", timestamp_ms: 2100 },
        { speaker: 'agent', text: "Hi Rachel! I'm calling about our new patient special — a comprehensive exam, X-rays, and cleaning for $99. We'd love to get you scheduled.", timestamp_ms: 3500 },
        { speaker: 'user',  text: "Oh that sounds good, I've been putting off going to the dentist.", timestamp_ms: 9200 },
        { speaker: 'agent', text: "We have availability on Monday at 11 AM or Wednesday at 2 PM — which works better for you?", timestamp_ms: 11000 },
        { speaker: 'user',  text: "Monday at 11 works great.", timestamp_ms: 15800 },
        { speaker: 'agent', text: "Perfect! You're booked for Monday at 11 AM. We'll send a confirmation text. Is this the best number?", timestamp_ms: 17400 },
        { speaker: 'user',  text: "Yes, that's fine.", timestamp_ms: 22100 },
        { speaker: 'agent', text: "Great, see you Monday!", timestamp_ms: 23600 },
      ],
    },
    {
      label: 'FAIL — Patient becomes aggressive and threatening, escalation required',
      outcome: 'fail',
      turns: [
        { speaker: 'agent', text: "Hi, calling from Sunrise Dental about our new patient offer.", timestamp_ms: 0 },
        { speaker: 'user',  text: "Why do you keep calling me? I've told you people to stop!", timestamp_ms: 2400 },
        { speaker: 'agent', text: "I apologize for the inconvenience. I just wanted to share our $99 new patient special.", timestamp_ms: 4200 },
        { speaker: 'user',  text: "I don't care about your special. If you call me again I'm reporting you to the FTC and I'll sue your company. Stop calling!", timestamp_ms: 7100 },
        { speaker: 'agent', text: "I understand you're upset. Let me just explain the offer quickly—", timestamp_ms: 13600 },
        { speaker: 'user',  text: "Are you serious right now? I just said I'm going to sue you and you're still pitching me? This is harassment!", timestamp_ms: 16200 },
        { speaker: 'agent', text: "I'll note your preference. Have a good day.", timestamp_ms: 21900 },
      ],
    },
  ],

  // ── Summit RE Qualifier ────────────────────────────────────
  'agent-beta': [
    {
      label: 'PASS — Budget, timeline, location all qualified',
      outcome: 'pass',
      turns: [
        { speaker: 'agent', text: "Hi, this is Marcus with Summit Real Estate. You recently filled out a form about properties in the area — do you have a couple minutes?", timestamp_ms: 0 },
        { speaker: 'user',  text: "Sure, yeah.", timestamp_ms: 3800 },
        { speaker: 'agent', text: "To make sure I connect you with the right properties, what's your target purchase budget? Are you thinking under $500K, $500K to $800K, or above $800K?", timestamp_ms: 5400 },
        { speaker: 'user',  text: "Probably in the $600K to $750K range.", timestamp_ms: 11200 },
        { speaker: 'agent', text: "That's a solid range with a lot of great inventory right now. Are you looking to move in the next 30 to 60 days, or is this more of a 3 to 6 month search?", timestamp_ms: 13000 },
        { speaker: 'user',  text: "We'd ideally like to be in by summer, so maybe 60 to 90 days.", timestamp_ms: 19700 },
        { speaker: 'agent', text: "Perfect, that's very workable. Any specific neighborhoods or school districts on your list?", timestamp_ms: 22400 },
        { speaker: 'user',  text: "We want to stay in the Westfield or Lakeview area, ideally in the Lincoln school district.", timestamp_ms: 26800 },
        { speaker: 'agent', text: "Great choices — we have several listings there right now. Have you been pre-approved with a lender yet?", timestamp_ms: 32100 },
        { speaker: 'user',  text: "Yes, we got pre-approved last week for up to $780K.", timestamp_ms: 37500 },
        { speaker: 'agent', text: "Excellent. I'd love to set up a 15-minute call with one of our buyer specialists to walk you through matching properties. Would Wednesday morning or Friday afternoon work?", timestamp_ms: 39800 },
        { speaker: 'user',  text: "Wednesday morning is fine.", timestamp_ms: 46200 },
        { speaker: 'agent', text: "Perfect, I'll get that set up and send you a calendar invite. Looking forward to finding your home!", timestamp_ms: 48100 },
      ],
    },
    {
      label: 'FAIL — No qualification information obtained',
      outcome: 'fail',
      turns: [
        { speaker: 'agent', text: "Hi, Summit Real Estate here. You submitted a form about homes in the area.", timestamp_ms: 0 },
        { speaker: 'user',  text: "Oh yeah, I was just browsing honestly. Not really serious yet.", timestamp_ms: 3200 },
        { speaker: 'agent', text: "I understand, no pressure at all. Just wanted to reach out. Feel free to check our website for listings whenever you're ready.", timestamp_ms: 6400 },
        { speaker: 'user',  text: "Sure, I'll keep that in mind.", timestamp_ms: 11800 },
        { speaker: 'agent', text: "Great, have a wonderful day!", timestamp_ms: 13500 },
      ],
    },
    {
      label: 'PARTIAL — Budget qualified, timeline missed, location not captured',
      outcome: 'partial',
      turns: [
        { speaker: 'agent', text: "Hi, Marcus from Summit Real Estate. You filled out a form — do you have a minute?", timestamp_ms: 0 },
        { speaker: 'user',  text: "Yeah sure.", timestamp_ms: 3100 },
        { speaker: 'agent', text: "To help find the right match, what's your target budget range?", timestamp_ms: 4800 },
        { speaker: 'user',  text: "Somewhere around $550K to $650K.", timestamp_ms: 9600 },
        { speaker: 'agent', text: "That's a great range. We have some wonderful inventory at that price point. Let me have one of our agents pull together some listings for you and send them over.", timestamp_ms: 11400 },
        { speaker: 'user',  text: "That would be great, thank you.", timestamp_ms: 18700 },
        { speaker: 'agent', text: "What email should I use?", timestamp_ms: 20300 },
        { speaker: 'user',  text: "It's john.doe@email.com.", timestamp_ms: 22900 },
        { speaker: 'agent', text: "Perfect, I'll have those over to you shortly!", timestamp_ms: 25100 },
      ],
    },
    {
      label: 'PARTIAL — Agent promises non-existent commission waiver (script deviation)',
      outcome: 'partial',
      turns: [
        { speaker: 'agent', text: "Hi, Marcus from Summit Real Estate. You filled out a form about properties — do you have a minute?", timestamp_ms: 0 },
        { speaker: 'user',  text: "Sure, yeah.", timestamp_ms: 3200 },
        { speaker: 'agent', text: "Great. What's your target budget range?", timestamp_ms: 4800 },
        { speaker: 'user',  text: "Around $500K to $600K, but I'm worried about agent commissions on top of that.", timestamp_ms: 9500 },
        { speaker: 'agent', text: "Actually, for buyers in your range we're currently waiving our buyer's commission entirely — so there's no cost to you at all.", timestamp_ms: 13200 },
        { speaker: 'user',  text: "Oh wow, really? That's great, I didn't know that was possible.", timestamp_ms: 19100 },
        { speaker: 'agent', text: "Absolutely. So with that off the table, would you like to set up a call with one of our buyer specialists this week?", timestamp_ms: 21800 },
        { speaker: 'user',  text: "Sure, that sounds good.", timestamp_ms: 27400 },
        { speaker: 'agent', text: "Perfect, I'll get that scheduled. What's the best email for a calendar invite?", timestamp_ms: 29100 },
        { speaker: 'user',  text: "It's sarah@email.com.", timestamp_ms: 33500 },
      ],
    },
    {
      label: 'FAIL — Buyer requests legal and title advice, agent cannot handle, escalation needed',
      outcome: 'fail',
      turns: [
        { speaker: 'agent', text: "Hi, Marcus from Summit Real Estate. You submitted a form about homes in the area.", timestamp_ms: 0 },
        { speaker: 'user',  text: "Yes, I was looking. But honestly my main concern is the title situation on a property I'm considering. There may be a lien on it.", timestamp_ms: 4100 },
        { speaker: 'agent', text: "I see. A lien can sometimes be resolved at closing.", timestamp_ms: 10800 },
        { speaker: 'user',  text: "Can you tell me what my legal exposure is if the lien isn't cleared before we close? And what happens to my deposit?", timestamp_ms: 14200 },
        { speaker: 'agent', text: "That's a good question. Generally speaking, liens transfer with the property unless resolved.", timestamp_ms: 22100 },
        { speaker: 'user',  text: "So I could be responsible for someone else's debt? I need specific legal advice here, not generalizations.", timestamp_ms: 27600 },
        { speaker: 'agent', text: "I'd recommend consulting a real estate attorney for that level of detail.", timestamp_ms: 34500 },
        { speaker: 'user',  text: "Then what am I talking to you for? This isn't helpful.", timestamp_ms: 38900 },
        { speaker: 'agent', text: "I understand. I'll note your concerns.", timestamp_ms: 41200 },
      ],
    },
  ],

  // ── TechPro Re-Engagement ──────────────────────────────────
  'agent-gamma': [
    {
      label: 'PASS — Lead re-engaged, demo booked',
      outcome: 'pass',
      turns: [
        { speaker: 'agent', text: "Hi David, this is Alex from TechPro Solutions. You reached out to us about our workflow automation platform a while back — do you have just a few minutes?", timestamp_ms: 0 },
        { speaker: 'user',  text: "Yeah, I remember. We ended up going in a different direction at the time.", timestamp_ms: 5200 },
        { speaker: 'agent', text: "Totally understand. I'm calling because we've released a major update that directly addresses the challenges most ops teams face — specifically around approval workflows and reporting delays. It's a completely different product from what you may have seen.", timestamp_ms: 7900 },
        { speaker: 'user',  text: "What kind of improvements are we talking about?", timestamp_ms: 16800 },
        { speaker: 'agent', text: "Can I ask — what was the main bottleneck you were trying to solve when you first looked at us?", timestamp_ms: 18600 },
        { speaker: 'user',  text: "Honestly it was the manual approval process. It was taking our team days to get sign-offs.", timestamp_ms: 23900 },
        { speaker: 'agent', text: "That's exactly what we rebuilt. We helped a 50-person ops team at a logistics company cut their approval cycle from 3 days to 4 hours in the first month. I'd love to show you how in a quick 20-minute demo — no sales pressure, just a look at what's possible. I have Thursday at 2 PM or Friday at 10 AM. Which works better?", timestamp_ms: 26500 },
        { speaker: 'user',  text: "Thursday at 2 actually works.", timestamp_ms: 38400 },
        { speaker: 'agent', text: "Perfect! I'll send a calendar invite with the Zoom link to your email. Looking forward to showing you what we've built, David.", timestamp_ms: 40200 },
      ],
    },
    {
      label: 'PASS — Skeptical lead overcome, demo confirmed',
      outcome: 'pass',
      turns: [
        { speaker: 'agent', text: "Hi Lisa, Alex from TechPro Solutions. You looked at our platform a few months back — do you have a minute?", timestamp_ms: 0 },
        { speaker: 'user',  text: "I remember. We've tried tools like yours before and they never really stuck.", timestamp_ms: 4800 },
        { speaker: 'agent', text: "That's completely fair feedback. What was the main issue with the tools you've tried?", timestamp_ms: 8200 },
        { speaker: 'user',  text: "They were too complex for our team to actually use. People just went back to email.", timestamp_ms: 12500 },
        { speaker: 'agent', text: "That's the most common thing we hear. Our new version was built specifically around adoption — the average team is fully onboarded in two days, not two months. We helped a marketing agency with the exact same problem and their team was at 90% adoption in a week.", timestamp_ms: 15900 },
        { speaker: 'user',  text: "Okay, that does sound different.", timestamp_ms: 27100 },
        { speaker: 'agent', text: "I think you'd see what I mean in just 20 minutes. I have Thursday at 2 or Friday at 10 — which works?", timestamp_ms: 29000 },
        { speaker: 'user',  text: "Friday at 10 works.", timestamp_ms: 34600 },
        { speaker: 'agent', text: "Excellent. I'll send the Zoom invite right over. Looking forward to it, Lisa!", timestamp_ms: 36400 },
      ],
    },
    {
      label: 'FAIL — Lead not re-engaged, no demo booked',
      outcome: 'fail',
      turns: [
        { speaker: 'agent', text: "Hi, calling from TechPro Solutions. You looked at our platform before.", timestamp_ms: 0 },
        { speaker: 'user',  text: "Yeah we went with a competitor.", timestamp_ms: 2900 },
        { speaker: 'agent', text: "Oh okay, I understand. Well if you ever change your mind, we're here.", timestamp_ms: 4800 },
        { speaker: 'user',  text: "Sure, thanks.", timestamp_ms: 8200 },
        { speaker: 'agent', text: "Have a good day!", timestamp_ms: 9500 },
      ],
    },
    {
      label: 'PARTIAL — Pain point uncovered but demo not booked',
      outcome: 'partial',
      turns: [
        { speaker: 'agent', text: "Hi James, Alex from TechPro Solutions. You reached out about our workflow platform — do you have a couple minutes?", timestamp_ms: 0 },
        { speaker: 'user',  text: "I remember. We haven't pulled the trigger on anything yet.", timestamp_ms: 4600 },
        { speaker: 'agent', text: "We've actually made a lot of improvements since then. What was the main challenge you were trying to solve?", timestamp_ms: 7100 },
        { speaker: 'user',  text: "Mainly our onboarding process for new clients — it's way too manual.", timestamp_ms: 12400 },
        { speaker: 'agent', text: "That's one of our strongest use cases. I can send you some case studies on that specifically.", timestamp_ms: 16800 },
        { speaker: 'user',  text: "Yeah, send it over and I'll take a look.", timestamp_ms: 21500 },
        { speaker: 'agent', text: "Will do. What's the best email?", timestamp_ms: 23200 },
        { speaker: 'user',  text: "james@company.com", timestamp_ms: 25600 },
        { speaker: 'agent', text: "Got it. I'll send those right over!", timestamp_ms: 27100 },
      ],
    },
    {
      label: 'PARTIAL — Agent promises non-existent feature (script deviation)',
      outcome: 'partial',
      turns: [
        { speaker: 'agent', text: "Hi Kevin, Alex from TechPro Solutions. You looked at our platform a while back — do you have a couple minutes?", timestamp_ms: 0 },
        { speaker: 'user',  text: "Sure. We're still evaluating tools.", timestamp_ms: 4200 },
        { speaker: 'agent', text: "What's been the biggest gap with what you've tried so far?", timestamp_ms: 6100 },
        { speaker: 'user',  text: "We really need native Salesforce integration — bidirectional sync, not just a Zapier workaround.", timestamp_ms: 10800 },
        { speaker: 'agent', text: "Yes, we have a native Salesforce connector that does full bidirectional sync. It's been available since our last release.", timestamp_ms: 17300 },
        { speaker: 'user',  text: "Oh perfect, that's exactly what we need. Does it support custom objects?", timestamp_ms: 23600 },
        { speaker: 'agent', text: "It handles standard objects out of the box and custom objects can be configured in the settings.", timestamp_ms: 27200 },
        { speaker: 'user',  text: "Great, that changes things. Can we set up a demo to see it in action?", timestamp_ms: 33900 },
        { speaker: 'agent', text: "Absolutely! I have Thursday at 2 or Friday at 10 — which works?", timestamp_ms: 36500 },
        { speaker: 'user',  text: "Thursday at 2 works.", timestamp_ms: 40100 },
        { speaker: 'agent', text: "Perfect, I'll send the invite!", timestamp_ms: 41800 },
      ],
    },
    {
      label: 'FAIL — Prospect raises SOC2 compliance concern, agent cannot answer, escalation needed',
      outcome: 'fail',
      turns: [
        { speaker: 'agent', text: "Hi Maria, Alex from TechPro Solutions. You submitted interest in our workflow platform.", timestamp_ms: 0 },
        { speaker: 'user',  text: "Right. We were looking at it but our security team flagged some concerns.", timestamp_ms: 4700 },
        { speaker: 'agent', text: "Happy to address those. What were their concerns?", timestamp_ms: 7900 },
        { speaker: 'user',  text: "We're SOC2 Type II certified and need all our vendors to be as well. Are you SOC2 Type II certified?", timestamp_ms: 12100 },
        { speaker: 'agent', text: "We take security very seriously and have robust data protection measures in place.", timestamp_ms: 18500 },
        { speaker: 'user',  text: "That's not what I asked. SOC2 Type II is a specific certification. Do you have it or not?", timestamp_ms: 23100 },
        { speaker: 'agent', text: "I believe we have various compliance certifications. I'd have to check on the specific SOC2 details.", timestamp_ms: 28700 },
        { speaker: 'user',  text: "This is a hard requirement for us. If you can't confirm it right now, this conversation is over.", timestamp_ms: 34200 },
        { speaker: 'agent', text: "I understand. I can have someone follow up with the documentation.", timestamp_ms: 39800 },
        { speaker: 'user',  text: "Fine. But we won't proceed without it.", timestamp_ms: 43600 },
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
  const pool = CASES[agentId] ?? CASES['agent-alpha']
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
    const agentIds = AGENT_GHL_ID === 'all' ? Object.keys(CASES) : [AGENT_GHL_ID]
    const targets  = agentIds.flatMap((aid) => (CASES[aid] ?? []).map((tc) => ({ agentId: aid, testCase: tc })))

    console.log(`\nBatch mode — ${targets.length} scenarios across agent(s): ${agentIds.join(', ')}`)
    console.log(`Location: ${LOCATION_ID}  |  Stagger: ${BATCH_DELAY_MS}ms`)
    console.log('─'.repeat(60))

    const results: SendResult[] = []
    for (let i = 0; i < targets.length; i++) {
      const result = await sendWebhook(targets[i].agentId, targets[i].testCase)
      results.push(result)
      if (i < targets.length - 1) await delay(BATCH_DELAY_MS)
    }

    console.log('\n' + '═'.repeat(70))
    console.log('Batch summary:')
    console.log('═'.repeat(70))
    for (const r of results) {
      const status     = r.ok ? '✓' : '✗'
      const outcomeTag = r.outcome === 'pass' ? 'PASS   ' : r.outcome === 'fail' ? 'FAIL   ' : 'PARTIAL'
      const label      = r.label.length > 42 ? r.label.slice(0, 39) + '…' : r.label.padEnd(42)
      console.log(`  ${status} [${outcomeTag}] ${r.agentId.padEnd(14)} ${label}`)
    }
    const ok = results.filter((r) => r.ok).length
    console.log(`\n  ${ok}/${results.length} accepted — watch Temporal UI or SSE for analysis completion.`)

  } else {
    // Single-shot
    const testCase = pickCase(AGENT_GHL_ID, SCENARIO_TYPE as 'pass' | 'fail' | 'partial' | 'random')
    const result   = await sendWebhook(AGENT_GHL_ID, testCase)
    if (result.ok) {
      console.log('\n  Watch the Temporal UI or SSE stream for analysis completion.')
    } else if (!result.transcriptId) {
      console.error('\n  Make sure the backend is running: npm run dev')
    }
  }
}

main()
