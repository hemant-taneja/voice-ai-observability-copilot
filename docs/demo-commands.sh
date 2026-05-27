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
#  https://voice-agent-copilot.duckdns.org?locationId=loc-seed-1
#
#  ⚠️  The ?locationId=loc-seed-1 param is required.
#      Without it the app falls back to demo-location-001
#      and shows no agents. Fix in progress.
# =============================================================


# ── STEP 0: Reset before demo ────────────────────────────────
sudo docker compose exec app node dist/scripts/reset-demo.js


# ── STEP 1: Simulation — PASS ────────────────────────────────
sudo docker compose exec app node dist/scripts/simulate-webhook.js ghl-ag-1 pass


# ── STEP 2: Simulation — FAIL ────────────────────────────────
sudo docker compose exec app node dist/scripts/simulate-webhook.js ghl-ag-1 fail


# ── STEP 3: Simulation — PARTIAL (main demo case) ────────────
sudo docker compose exec app node dist/scripts/simulate-webhook.js ghl-ag-1 partial


# ── ALL 3 IN ONE GO (alternative, 2s stagger between each) ───
sudo docker compose exec app node dist/scripts/simulate-webhook.js all


# ── RESET AGAIN (if re-running the demo) ─────────────────────
sudo docker compose exec app node dist/scripts/reset-demo.js
