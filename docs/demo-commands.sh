#!/usr/bin/env bash
# =============================================================
#  VOICE AI COPILOT — DEMO COMMANDS
#  Keep this file open in a terminal tab during the demo.
#  All commands run on the GCP VM (SSH in first).
# =============================================================

# ── Connect to VM ─────────────────────────────────────────────
#   ssh hemanttaneja30@35.207.209.250

# ── Temporal UI tunnel (keep open in a separate local terminal) ─
#   ssh -L 8080:localhost:8080 hemanttaneja30@35.207.209.250
#   Open: http://localhost:8080


# =============================================================
#  DASHBOARD URL
#  https://voice-agent-copilot.duckdns.org?locationId=TJkIaqSqj7jectw2dxRx
#  (or open from the HighLevel marketplace iframe — locationId injected automatically)
# =============================================================


# ════════════════════════════════════════════════════════════
#  DEMO SETUP  (run once before demo, in order)
# ════════════════════════════════════════════════════════════

# STEP 1 — Seed demo agents + sample call history
#   Creates Aria, Marcus, Sophie with KPI configs and 3 pre-analyzed calls.
#   Safe to re-run: preserves OAuth token and any real HL-synced agents.
sudo docker compose exec app node dist/scripts/seed.js


# STEP 2 — (Optional) Confirm which agents are in the DB
sudo docker compose exec app node -e "
const {db}=require('./dist/db/index');
db.query(\"SELECT ghl_agent_id, name FROM agents WHERE location_id='TJkIaqSqj7jectw2dxRx'\")
  .then(r=>{console.log(r.rows);process.exit()})
"


# ════════════════════════════════════════════════════════════
#  DEMO RESET  (use between demo runs to clear call data)
# ════════════════════════════════════════════════════════════
sudo docker compose exec app node dist/scripts/reset-demo.js


# ════════════════════════════════════════════════════════════
#  SIMULATIONS  (Section 3 of demo — run in order)
#  Default agent is ghl-ag-1 (Sophie — Dental Care Coordinator).
#  Pass a different ghl_agent_id as first arg if needed.
# ════════════════════════════════════════════════════════════

# Pass
sudo docker compose exec app node dist/scripts/simulate-webhook.js ghl-ag-1 pass

# Fail
sudo docker compose exec app node dist/scripts/simulate-webhook.js ghl-ag-1 fail

# Partial  ← main demo moment
sudo docker compose exec app node dist/scripts/simulate-webhook.js ghl-ag-1 partial

# All 3 at once (2s stagger)
sudo docker compose exec app node dist/scripts/simulate-webhook.js all
