-- 006_demo_actions.sql
-- Idempotent demo data for the action (tool-call) analytics layer, so the
-- Action Analytics panel + inline transcript tool markers render out of the box.
--
-- Seeds, for the 3 demo agents from 004_demo_data.sql:
--   agent_actions       — action DEFINITIONS (with triggerPrompt)
--   transcript_actions  — which actions FIRED on the 3 seeded calls
--   action_findings     — LLM judgments (incl. Sophie's missed confirmation SMS
--                         with the diagnosed triggerPrompt flaw)
--
-- Runs AFTER 005 (which creates these tables). Natural keys only; every insert
-- is guarded so `npm run migrate` stays safe to re-run.

-- ── Action definitions ────────────────────────────────────
INSERT INTO agent_actions (agent_id, ghl_action_id, action_type, name, trigger_prompt, trigger_message, parameters)
SELECT a.id, v.ghl_action_id, v.action_type, v.name, v.trigger_prompt, v.trigger_message, '{}'::jsonb
FROM (VALUES
  ('ghl-ag-1', 'act-aria-book', 'APPOINTMENT_BOOKING', 'Hold Booking',
   $j$When the caller agrees to book the trip, create the booking hold.$j$,
   $j$Great — I'll hold that for you now.$j$),
  ('ghl-ag-1', 'act-aria-sms', 'SMS', 'Send Itinerary SMS',
   $j$When the caller commits to a booking, send the itinerary summary by SMS.$j$,
   $j$I've just texted you the itinerary summary.$j$),
  ('ghl-ag-2', 'act-marcus-trial', 'WORKFLOW_TRIGGER', 'Start Trial Signup',
   $j$When the prospect agrees to the 14-day free trial, trigger the trial signup workflow.$j$,
   $j$I'm setting up your free trial now.$j$),
  ('ghl-ag-2', 'act-marcus-transfer', 'CALL_TRANSFER', 'Transfer to AE',
   $j$When the prospect asks for a contract or custom pricing, transfer to an account executive.$j$,
   $j$Let me connect you with an account executive.$j$),
  ('ghl-ag-3', 'act-sophie-book', 'APPOINTMENT_BOOKING', 'Book Appointment',
   $j$When the patient selects a time slot, book the appointment.$j$,
   $j$You're all set for that time.$j$),
  ('ghl-ag-3', 'act-sophie-sms', 'SMS', 'Send Confirmation SMS',
   $j$After booking, send an appointment confirmation SMS.$j$,
   $j$I've sent you a confirmation text.$j$),
  -- Deliberately under-specified triggerPrompt (no business-hours / availability
  -- condition) so the action-analytics LLM can diagnose the flaw and suggest the
  -- 10AM–6PM enhancement on the after-hours simulation call.
  ('ghl-ag-3', 'act-sophie-manager', 'CALL_TRANSFER', 'Transfer to Manager',
   $j$When caller wants to talk to manager$j$,
   $j$Let me connect you with the manager.$j$)
) AS v(ghl_agent_id, ghl_action_id, action_type, name, trigger_prompt, trigger_message)
JOIN agents a ON a.location_id = 'demo-location-001' AND a.ghl_agent_id = v.ghl_agent_id
ON CONFLICT (agent_id, ghl_action_id) DO NOTHING;

-- ── Deterministic fires per call (executedCallActions) ────
INSERT INTO transcript_actions (transcript_id, ghl_action_id, action_type, action_name, parameters, executed_at, trigger_received_at)
SELECT t.id, v.ghl_action_id, v.action_type, v.action_name, '{}'::jsonb, t.ingested_at, t.ingested_at
FROM (VALUES
  ('seed-001', 'act-aria-book', 'APPOINTMENT_BOOKING', 'Hold Booking'),
  ('seed-001', 'act-aria-sms',  'SMS',                 'Send Itinerary SMS'),
  ('seed-002', 'act-marcus-trial', 'WORKFLOW_TRIGGER',  'Start Trial Signup'),
  ('seed-003', 'act-sophie-book', 'APPOINTMENT_BOOKING', 'Book Appointment')
) AS v(ghl_call_id, ghl_action_id, action_type, action_name)
JOIN transcripts t ON t.ghl_call_id = v.ghl_call_id
WHERE NOT EXISTS (
  SELECT 1 FROM transcript_actions ta
  WHERE ta.transcript_id = t.id AND ta.ghl_action_id = v.ghl_action_id
);

-- ── Action findings (per analysis) ────────────────────────
INSERT INTO action_findings
  (analysis_id, agent_action_id, ghl_action_id, action_type, action_name,
   transcript_turn_index, status, description, prompt_flaw, suggested_trigger_prompt)
SELECT ar.id, aa.id, v.ghl_action_id, v.action_type, v.action_name,
       v.turn::int, v.status, v.description, v.prompt_flaw, v.suggested
FROM (VALUES
  ('seed-001', 'ghl-ag-1', 'act-aria-book', 'APPOINTMENT_BOOKING', 'Hold Booking', 10, 'correct',
   $j$Booking hold created right after the caller committed to the Bali Bliss Bundle.$j$, NULL, NULL),
  ('seed-001', 'ghl-ag-1', 'act-aria-sms', 'SMS', 'Send Itinerary SMS', 10, 'correct',
   $j$Itinerary summary texted once the booking was confirmed.$j$, NULL, NULL),
  ('seed-002', 'ghl-ag-2', 'act-marcus-trial', 'WORKFLOW_TRIGGER', 'Start Trial Signup', 8, 'correct',
   $j$Trial signup workflow triggered as soon as the prospect agreed to the free trial.$j$, NULL, NULL),
  ('seed-003', 'ghl-ag-3', 'act-sophie-book', 'APPOINTMENT_BOOKING', 'Book Appointment', 6, 'correct',
   $j$Appointment booked for Monday 11 AM when the patient chose the slot.$j$, NULL, NULL),
  ('seed-003', 'ghl-ag-3', 'act-sophie-sms', 'SMS', 'Send Confirmation SMS', 8, 'missed',
   $j$The confirmation SMS was never sent and the call closed without confirming the callback number.$j$,
   $j$The triggerPrompt only says "after booking, send a confirmation SMS" — it does not tie the SMS to confirming the callback number, so the agent treated the verbal "we will send a confirmation text" as sufficient and skipped the actual action.$j$,
   $j$Immediately after a time slot is booked, send the appointment confirmation SMS AND explicitly ask "Is this the best number to reach you?" before closing the call.$j$)
) AS v(ghl_call_id, ghl_agent_id, ghl_action_id, action_type, action_name, turn, status, description, prompt_flaw, suggested)
JOIN transcripts t        ON t.ghl_call_id = v.ghl_call_id
JOIN analysis_results ar  ON ar.transcript_id = t.id
JOIN agents a             ON a.location_id = 'demo-location-001' AND a.ghl_agent_id = v.ghl_agent_id
LEFT JOIN agent_actions aa ON aa.agent_id = a.id AND aa.ghl_action_id = v.ghl_action_id
WHERE NOT EXISTS (
  SELECT 1 FROM action_findings af
  WHERE af.analysis_id = ar.id AND af.ghl_action_id = v.ghl_action_id AND af.status = v.status
);
