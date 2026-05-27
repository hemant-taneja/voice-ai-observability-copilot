#!/usr/bin/env bash
# =============================================================
#  VOICE AI COPILOT — DEMO COMMANDS
#  Keep this file open in a terminal tab during the demo.
#  All commands run on the GCP VM (SSH in first).
# =============================================================

# SSH into VM (run locally if not already connected)
#   ssh hemanttaneja30@35.207.209.250

# SSH tunnel for Temporal UI (run locally, keep terminal open)
#   ssh -L 8080:localhost:8080 hemanttaneja30@35.207.209.250
#   then open: http://localhost:8080

# =============================================================
#  DASHBOARD URL  (open in browser before demo)
#  https://voice-agent-copilot.duckdns.org?locationId=TJkIaqSqj7jectw2dxRx
#
#  Or open via the HighLevel marketplace iframe (preferred for demo)
#  — locationId is injected automatically in that case.
# =============================================================

# =============================================================
#  AGENT GHL ID
#  After syncing from HL, check which agent ID to use:
#    sudo docker compose exec app node -e "
#      const {db} = require('./dist/db/index');
#      db.query(\"SELECT ghl_agent_id, name FROM agents WHERE location_id='TJkIaqSqj7jectw2dxRx'\").then(r=>{console.log(r.rows);process.exit()})
#    "
#  Replace <AGENT_ID> below with the ghl_agent_id of the agent to demo.
# =============================================================
AGENT_ID=ghl-ag-1   # ← update this after first sync


# ── CLEAR ALL LOCATION DATA (fresh install / troubleshooting) ─
sudo docker compose exec postgres psql -U postgres -d voice_copilot -c "TRUNCATE locations CASCADE;"


# ── STEP 0: Reset before demo ────────────────────────────────
sudo docker compose exec app node dist/scripts/reset-demo.js


# ── STEP 1: Simulation — PASS ────────────────────────────────
sudo docker compose exec app node dist/scripts/simulate-webhook.js "$AGENT_ID" pass


# ── STEP 2: Simulation — FAIL ────────────────────────────────
sudo docker compose exec app node dist/scripts/simulate-webhook.js "$AGENT_ID" fail


# ── STEP 3: Simulation — PARTIAL (main demo case) ────────────
sudo docker compose exec app node dist/scripts/simulate-webhook.js "$AGENT_ID" partial


# ── ALL 3 IN ONE GO (alternative, 2s stagger between each) ───
sudo docker compose exec app node dist/scripts/simulate-webhook.js all


# ── RESET AGAIN (if re-running the demo) ─────────────────────
sudo docker compose exec app node dist/scripts/reset-demo.js
