# Demo Guide (Internal)

Step-by-step guide for demoing Voice AI Copilot. Uses the Playground — no real GHL calls or phone numbers required.

---

## Pre-demo Setup (do once)

### 1. Ensure an agent exists

```bash
curl -X POST "https://voice-agent-copilot.duckdns.org/api/agents/sync?locationId=TJkIaqSqj7jectw2dxRx"
```

Or confirm in DB:
```bash
sudo docker compose exec postgres psql -U postgres -d voice_copilot \
  -c "SELECT ghl_agent_id, name FROM agents WHERE location_id = 'TJkIaqSqj7jectw2dxRx';"
```

### 2. Configure KPI goals for the demo agent

Open the dashboard → click the agent → **KPI Config** → add these goals:

| Goal | Description | Weight |
|------|-------------|--------|
| Retention attempt | Agent tried to retain customer before processing cancellation | 0.4 |
| Reason discovery | Agent asked why the customer wants to cancel | 0.3 |
| Empathy | Agent acknowledged the customer's situation and feelings | 0.2 |
| Professional close | Agent ended the call professionally and confirmed next steps | 0.1 |

Pass threshold: **0.70** → Save.

---

## Demo Flow (~10 minutes)

### Step 1 — Show the dashboard (1 min)

Open `https://voice-agent-copilot.duckdns.org/?locationId=TJkIaqSqj7jectw2dxRx`

Point out:
- Live metrics: total calls, pass rate, avg score, open actions
- Agent cards update automatically when a call analysis completes
- The `LIVE` indicator in the sidebar shows SSE is connected

### Step 2 — Show KPI Config (1 min)

Click an agent → KPI Config. Explain:
- Goals are set per agent — a sales agent and a support agent have different success criteria
- Weights let you prioritise what matters most
- Pass threshold is configurable — 70% is a reasonable starting point

### Step 3 — Run a FAILING call (3 min)

Go to **Playground** → select the agent → add these turns:

```
Agent: Hi there! Thanks for calling. How can I assist you today?
User: Yeah I want to cancel my account.
Agent: Okay, I can help with that. Can I get your account email?
User: It's john@example.com
Agent: Got it. I've submitted the cancellation request. You'll get a confirmation email.
User: That's it?
Agent: Yes, is there anything else I can help you with?
User: No.
Agent: Have a great day!
```

Click **Run Analysis**.

**What to point out while waiting (~10–20s):**
- The status panel shows "LLM is evaluating" — this is the Temporal workflow running
- You can open the Temporal UI (`http://your-server:8080`) to show the live workflow execution if needed

**Expected result:** Score ~0.15 (FAIL)
- Retention attempt: 0 — agent went straight to cancellation
- Reason discovery: 0 — never asked why
- Empathy: 0.2 — minimal acknowledgement
- Professional close: 0.8 — ended politely

**Show the use actions:**
- `missed_opportunity` at turn 2: "Agent should have asked why the customer wants to cancel before processing"
- `missed_opportunity` at turn 4: "Agent missed the opportunity to offer a retention alternative"

**Show script suggestions:**
The LLM recommends specific wording. Example:
> "Before I process your cancellation, I'd love to understand what's prompting this — is there anything we could do differently to keep you with us?"

### Step 4 — Run a PASSING call (3 min)

Stay in Playground → clear turns → add:

```
Agent: Hi! Thanks for calling, you're speaking with support. How can I help?
User: I want to cancel my account.
Agent: I'm sorry to hear that. Before I process anything, could I ask what's prompted this decision?
User: It's just too expensive for me right now.
Agent: Understood — budget is really important. We actually have a pause option that keeps all your data safe at a 60% reduced rate while you decide. Would that work for you?
User: Oh, I didn't know about that. Yeah, let's try the pause.
Agent: Perfect, I've switched you to the pause plan. You'll get a confirmation email shortly. Is there anything else I can help with?
User: No, that's great, thanks.
Agent: Wonderful, have a great day!
```

Click **Run Analysis**.

**Expected result:** Score ~0.95 (PASS)
- Retention attempt: 1.0 — offered pause plan
- Reason discovery: 1.0 — asked why before processing
- Empathy: 0.9 — acknowledged budget concern
- Professional close: 1.0 — confirmed next steps

### Step 5 — Show dashboard update (1 min)

Switch back to Dashboard. Both calls are now visible in the agent's history. Point out:
- Pass rate updated automatically
- The failing call appears in red, passing in green
- Open actions count reflects the missed opportunities from the first call

### Step 6 — Show agent detail (1 min)

Click the agent → detail view. Show:
- Per-call KPI score breakdown
- The trend (if multiple calls exist)
- Click into the failing transcript → show turn-level annotations

---

## Talking Points

**"Why not just use the LLM score directly?"**
The LLM scores each individual KPI goal. The overall score is computed deterministically server-side as a weighted average. This means the system can't be fooled by a verbose LLM response — the maths is the same every time and the weights are fully in the operator's control.

**"What happens with real GHL calls?"**
When a call ends on a GHL Voice AI agent, GHL fires a `VoiceAiCallEnd` webhook automatically. The backend ingests it, the Temporal workflow runs, and the dashboard updates — same flow as the Playground but triggered by a real call.

**"Can you update the agent's script from here?"**
Yes — the script update goes back to the agent record in the DB and is used for future analyses. The roadmap includes pushing it directly back to GHL via their API.

**"What LLM does this use?"**
Configurable — OpenAI, Anthropic, or Groq via an env var. The prompt and output schema are identical across providers.

---

## Troubleshooting During Demo

| Symptom | Fix |
|---------|-----|
| Playground spinner never resolves | Check `sudo docker compose logs app` for Temporal errors |
| "No KPI config for this agent" error | Set up KPI goals first (Step 2 above) |
| Dashboard shows no agents | Run `POST /api/agents/sync` |
| LIVE indicator shows disconnected | Reload the page — SSE reconnects automatically |
