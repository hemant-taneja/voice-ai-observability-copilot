# Voice AI Copilot — Demo Script
**Target: 5–7 minutes**

Related files:
- Commands to run → `docs/demo-commands.sh`  (keep this open in a VM terminal)
- Architecture diagram → `docs/architecture.md`  (open when reaching Section 6)

---

## Before You Start

1. SSH into the VM. Open `docs/demo-commands.sh` in the terminal — every command you need is there in order.
2. Open a second local terminal and start the Temporal SSH tunnel:
   ```
   ssh -L 8080:localhost:8080 hemanttaneja30@35.207.209.250
   ```
3. Open these browser tabs in advance:
   - Dashboard: `https://voice-agent-copilot.duckdns.org?locationId=loc-seed-1`
   - Temporal UI: `http://localhost:8080`
   - GitHub Actions: repo → Actions tab
   - `docs/architecture.md` — open in a text editor or browser (for Section 6)
4. Run the reset command so the dashboard is clean:
   ```
   sudo docker compose exec app node dist/scripts/reset-demo.js
   ```

> ⚠️ **Known caveat — locationId is hardcoded for this demo account**
> The dashboard URL requires `?locationId=loc-seed-1` explicitly. Without it, the app
> falls back to `demo-location-001` (the old default) and shows no agents.
> In a real HighLevel installation the locationId is injected by the HL iframe at launch
> (OAuth install sets it automatically). This fallback will be fixed — it was a conscious
> trade-off to respect the demo deadline while architectural work continues in parallel.
> **For the demo, always use the full URL above.**

---

## Section 1 — Problem Statement + Agent Sync (45 sec)

**[SHOW: Dashboard — 3 agent cards visible, zero calls, empty transcript table]**

> *"Every AI voice agent your company runs makes dozens of calls a day. Right now you have no idea if those agents are following the script, handling objections correctly, or making promises that aren't authorised. You find out something went wrong when the customer complains — not in real time, not automatically. This product changes that."*

Point at the three agent cards on screen.

> *"These agents — Sarah, Mike, Emma — are pulled directly from the HighLevel account's Voice AI roster the moment the app is installed. When an agency installs from the marketplace, the OAuth flow completes, we receive the install webhook from HL, and we immediately call the HL Voice AI API to sync their agent list. Name, script, everything as configured in their HL account — no manual setup. The agency opens the dashboard and their agents are already there."*

**[Talking point if asked how sync works:]**
> *"It's a single API call to HighLevel's `/voice-ai/agents` endpoint using the OAuth access token from install. We upsert on `(locationId, ghlAgentId)` so re-installs or refreshes are safe. There's also a manual re-sync endpoint the dashboard can call if they add agents after install."*

> ⚠️ **Demo note:** In this demo the agents are seeded data (not a live HL sync) because the locationId is currently hardcoded to this demo account. In a real installation these would be the account's actual HL Voice AI agents. See the caveat section above.

---

## Section 2 — KPI Config Live Edit (60 sec)

**[SHOW: Click on "Sarah — Appointment Setter" agent card → Agent Detail page]**

Point at the header: name, pass rate chip, calls analyzed count.

**[SHOW: Expand "KPI Configuration" section]**

Current config visible:
- Book Appointment `0.60`
- Handle Objection `0.40`

**[LIVE EDIT on screen:]**
- Change Book Appointment weight to `0.50`
- Change Handle Objection weight to `0.30`
- Click **+ Add Goal**
  - Name: `Confirm Phone Number`
  - Description: `Agent must ask if the contact number is correct before ending the call`
  - Weight: `0.20`
- Click **Save Configuration**

> *"The scoring criteria are fully customizable per agent. We just added a new requirement — confirm the phone number — and weighted it at 20%. Every future call for Sarah, including the ones we're about to fire, will be scored against this updated config immediately. No redeployment needed."*

---

## Section 3 — Live Simulations (2 min)

Switch to the VM terminal. Run commands from `docs/demo-commands.sh`.
Keep the dashboard visible on the other screen or in a split view.

### Case 1 — Pass

**[RUN in VM terminal:]**
```
sudo docker compose exec app node dist/scripts/simulate-webhook.js ghl-ag-1 pass
```

**[SHOW: Dashboard — watch the transcript row appear as "Pending", then resolve to Pass]**

The live indicator in the top-left pulses green while the SSE connection is active.

> *"Webhook received, Temporal workflow triggered, LLM analysed the transcript against Sarah's KPI config, result broadcast back to the browser over Server-Sent Events — under 10 seconds, no page refresh."*

---

### Case 2 — Fail

**[RUN in VM terminal:]**
```
sudo docker compose exec app node dist/scripts/simulate-webhook.js ghl-ag-1 fail
```

**[SHOW: Dashboard — second row resolves to Fail, both KPI bars red]**

> *"Agent received one objection and immediately apologised and ended the call. Didn't attempt a recovery, didn't offer any value, call over in 8 seconds. Without this tool, that call is invisible. You'd never know."*

---

### Case 3 — Partial  ← main demo moment

**[RUN in VM terminal:]**
```
sudo docker compose exec app node dist/scripts/simulate-webhook.js ghl-ag-1 partial
```

**[SHOW: Dashboard — third row resolves. Click the row to open the call analysis drawer.]**

---

## Section 4 — Partial Case Deep Dive (90 sec)

**[SHOW: Call analysis drawer — right panel slides in]**

Walk through top to bottom:

**Score block**
- Overall ~50–55%
- Point out it's lower than you might expect for a booked call

> *"The score dropped because the KPI config we just updated now includes 'Confirm Phone Number' — and this call failed that check. The config change you saw 2 minutes ago is already reflected here."*

**KPI Scores**

**[SHOW: KPI score bars — Book Appointment partial, Handle Objection red, Confirm Phone Number red]**

> *"Appointment was booked — partial credit. But the Handle Objection and Confirm Phone Number KPIs both failed."*

**USE Actions**

**[SHOW: USE Actions section — two flagged items]**
- `deviation` — Humana insurance confirmed (not in approved network)
- `missed_opportunity` — call ended without confirming contact number

Click into the transcript panel and scroll to the Humana turn.

**[SHOW: Transcript — highlight the agent turn where Humana is confirmed]**

> *"The agent told the patient we accept Humana. We don't. Our approved network is Delta Dental, Cigna, Aetna, and MetLife. That patient is going to arrive at the office and find out their insurance isn't covered. That's a churn event — and it likely happened on every call where this agent made the same mistake."*

**Script Suggestions**

**[SHOW: Click "View Suggested Changes" button in the Script section, or scroll to Script Suggestions panel]**

Two suggestions visible — one for the insurance deviation, one for the missing phone confirmation step. Each shows the original agent language and an LLM-generated rewrite.

> *"Not just detection. It tells the agent owner exactly what the agent should have said instead — with the rewritten line ready to apply. One click patches it into the live agent script."*

---

## Section 5 — Temporal UI (30 sec)

**[SHOW: Switch to Temporal UI browser tab — http://localhost:8080]**

Three completed `analyzeCall` workflows visible in the list.

> *"This is Temporal — the durable workflow engine running every analysis. If the LLM API times out, it retries automatically. If the server restarts mid-analysis, the workflow resumes exactly where it left off. No silent failures, no lost results."*

**[SHOW: Click one workflow → expand the activity timeline]**

Point at the four steps: `loadKpiConfig → runLlmAnalysis → persistResults → broadcastSSE`

---

## Section 6 — Architecture + Engineering Maturity (30 sec)

**[SHOW: Open docs/architecture.md]**

Briefly point at the diagram — webhook → Caddy → Express → Temporal worker → LLM → Redis → SSE → browser.

> *"The entire stack runs in Docker Compose on a single GCP VM: Postgres, Redis, Temporal, the Node backend, Caddy for HTTPS. LLM provider is a single environment variable — OpenAI today, swap to Anthropic or Groq with one line, no code change."*

**[SHOW: GitHub Actions tab — test job + deploy job]**

> *"Every push to main runs 57 automated tests, then SSHes into the VM and deploys. Zero manual steps."*

---

## Q&A Talking Points

**On agent sync from the marketplace:**
> *"When an agency installs the app from the HighLevel marketplace, OAuth completes and HL fires an AppInstall webhook. We use that event to mint a location-specific access token, then immediately call HL's Voice AI API to pull their agent roster — name, script, all of it. The agency opens the dashboard and their agents are already there, no manual config. There's also a re-sync endpoint if they add agents after install."*

**On the locationId / HL install:**
> *"The locationId is currently passed as a URL parameter for the demo — in production the HL iframe injects it automatically when the app is installed via OAuth. That plumbing is built; the fallback default in the frontend is what we're cleaning up. Architectural work took priority to meet the deadline and that's being fixed in parallel."*

**On transcript ingestion today:**
> *"The webhook receives call metadata. Full transcript data flows in when the voice provider — Twilio or HL native — includes it in the payload. The pipeline is fully built and ready; it's a data-availability question on the HL side, not an architecture gap."*

**On scale:**
> *"Temporal handles 1 concurrent analysis or 10,000 identically. Add more worker replicas, no code changes needed."*

**On re-analysis:**
> *"Change the KPI config at any time, hit Re-analyse on any past transcript. It re-scores with the new criteria — no need to re-ingest the call."*

**On LLM cost:**
> *"Each analysis is one LLM call — the full transcript plus KPI config as context. At current GPT-4o pricing, a 30-turn call costs roughly $0.01–0.02 to analyse."*

---

## Roadmap (if asked)

- Native transcript ingestion when HL exposes it, or direct Twilio integration
- Alerting — Slack / email when an agent's pass rate drops below threshold
- Bulk re-analysis — re-score all historical calls after a KPI config change
- Multi-agent benchmarking — compare agents side by side on the same KPIs
- White-label — per-location branding for agency resellers
