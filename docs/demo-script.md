# Voice AI Copilot — Speaker Notes
**5–7 minutes** · Commands → `docs/demo-commands.sh` · Architecture → `docs/architecture.md`

---

## Before You Start

- Terminal 1 (VM): `ssh hemanttaneja30@35.207.209.250` — keep `demo-commands.sh` open
- Terminal 2 (local): `ssh -L 8080:localhost:8080 hemanttaneja30@35.207.209.250`
- Browser tabs open: Dashboard · Temporal UI (`http://localhost:8080`) · GitHub Actions
- Run reset: `sudo docker compose exec app node dist/scripts/reset-demo.js`

> **Two modes:** Prefer live install from HL marketplace. Fallback: `https://voice-agent-copilot.duckdns.org?locationId=TJkIaqSqj7jectw2dxRx` with seeded agents — skip the sync beat if fallback.

---

## 1 · Problem + Install `45s`

**[HL Marketplace → click Install → OAuth → dashboard]**

Every voice agent your company runs makes dozens of calls a day. Right now you have no visibility into whether it's following the script, handling objections, or making unauthorised promises. You find out when the customer complains. This changes that.

Install is one OAuth click. The moment it completes we receive the webhook from HighLevel, store a location-scoped token, and pull the agent roster automatically. The agency opens the dashboard — agents already there. Zero manual setup.

---

## 1.5 · Live Agent Sync `30s`

**[HL Voice AI → create new agent e.g. "Alex — Insurance Specialist"]**

If the agency spins up a new agent after install — new campaign, new vertical — they don't need to touch anything. One button.

**[Dashboard → click "Sync from HighLevel" → new card appears]**

New agent is live in the system, ready for KPI goals and call analysis. No redeployment. No config.

---

## 2 · KPI Config Live Edit `60s`

**[Click agent card → Agent Detail → expand KPI Configuration]**

Scoring is fully customisable per agent. Watch this.

**[Edit on screen: Book Appointment → 0.50 · Handle Objection → 0.30 · + Add Goal]**
- Name: `Confirm Phone Number`
- Description: `Agent must ask if the contact number is correct before ending the call`
- Weight: `0.20`
- **[Save Configuration]**

New requirement added, weighted at 20%. Every future call — including the ones we're about to fire — scores against this immediately. No redeployment.

---

## 3 · Live Simulations `2 min`

**[Split view: terminal + dashboard]**

### Pass
```
simulate-webhook.js ghl-ag-1 pass
```
**[Row appears → Pending → Pass]**

Webhook in, Temporal workflow triggered, LLM scored against the KPI config, result pushed to the browser over SSE. Under 10 seconds. No page refresh.

### Fail
```
simulate-webhook.js ghl-ag-1 fail
```
**[Row → Fail, KPI bars red]**

Agent got one objection and immediately apologised and hung up. No recovery, no value. Without this tool that call is completely invisible.

### Partial ← main moment
```
simulate-webhook.js ghl-ag-1 partial
```
**[Row resolves → click row → drawer opens]**

---

## 4 · Partial Case Deep Dive `90s`

**[Call analysis drawer]**

**Score: ~50–55%** — lower than you'd expect for a call that technically booked an appointment.

That's because the new KPI we just added — Confirm Phone Number — already applies. Config change from 2 minutes ago is reflected right here.

**[KPI bars]**

Book Appointment — partial credit. Handle Objection and Confirm Phone Number — both failed.

**[USE Actions — two flags]**

- `deviation` — Humana confirmed as in-network
- `missed_opportunity` — call ended without asking for callback number

**[Click into transcript → scroll to Humana turn]**

The agent told the patient we accept Humana. We don't. Approved network is Delta Dental, Cigna, Aetna, MetLife. That patient shows up and finds out their insurance isn't covered. Churn event. And this likely happened on every call this agent made.

**[Script Suggestions panel]**

Not just detection — it tells the agent owner exactly what to say instead, with the rewrite ready to apply. One click patches the live agent script.

---

## 5 · Temporal `30s`

**[Temporal UI → three completed analyzeCall workflows]**

This is the durable workflow engine behind every analysis. LLM times out — auto retry. Server restarts mid-analysis — resumes from checkpoint. No silent failures.

**[Click workflow → activity timeline]**

Four steps: `loadKpiConfig → runLlmAnalysis → persistResults → broadcastSSE`

---

## 6 · Architecture + CI/CD `30s`

**[docs/architecture.md]**

Entire stack on one GCP VM in Docker Compose — Postgres, Redis, Temporal, Node backend, Caddy for HTTPS. LLM provider is one environment variable. OpenAI today, swap to Anthropic or Groq with one line, no code change.

**[GitHub Actions]**

Every push to main runs 57 automated tests then SSHes into the VM and deploys. Zero manual steps.

---

## Q&A

**Agent sync?** OAuth install fires an AppInstall webhook. We mint a location token, call HL's Voice AI API, pull the roster. Already there when the agency opens the dashboard. Re-sync button available anytime.

**LocationId?** In production the HL iframe injects it automatically. For demo we pass it as a URL param — that plumbing is built, just cleaning up the frontend fallback.

**Transcripts today?** Pipeline is fully built. Full transcript data flows in when the voice provider includes it in the payload — data-availability question on the HL side, not an architecture gap.

**Scale?** Temporal handles 1 analysis or 10,000 identically. Add worker replicas, no code changes.

**Re-analysis?** Change KPI config anytime, hit Re-analyse on any past transcript. Re-scores instantly.

**LLM cost?** One call per analysis. At GPT-4o pricing, a 30-turn call costs ~$0.01–0.02.

---

## Roadmap (if asked)

- Native transcript ingestion via HL or direct Twilio
- Alerting — Slack/email when pass rate drops below threshold
- Bulk re-analysis after KPI config changes
- Multi-agent benchmarking side by side
- White-label per-location branding for resellers
