---
name: ghl-copilot-scope-feature
description: Use when any feature request arrives for the Voice AI Observability Copilot, before planning or writing any code, to map all affected layers and surface integration risks.
---

# Scoping Features for the GHL Copilot

Run this before `superpowers:writing-plans`. Never skip it — GHL integration risks are non-obvious.

## Scope Checklist

Answer every question. Leave nothing as "probably fine."

### Backend
- [ ] New or modified **route**? Which domain file? (`webhooks`, `agents`, `analysis`, `kpi`)
- [ ] New or modified **service**? Is the logic reusable or single-use?
- [ ] **DB schema change**? If yes → migration file required.
- [ ] New or modified **GHL API call**? Check: required OAuth scope, rate limit, sandbox availability.
- [ ] **LLM prompt change**? Warning: affects all previously analyzed transcripts.

### Frontend
- [ ] New **view** (route-level page)? Add to `src/router/index.js`.
- [ ] New **component**? Reusable → `components/`. Page-specific → stay in `views/`.
- [ ] New **Pinia store state**? Or can an existing store be extended?
- [ ] New **API method** in `src/api/`?

### Integration Risk
- [ ] Touches **GHL OAuth / token handling**? → High risk. Test in sandbox before anything else.
- [ ] Touches **webhook processing**? → Missed events are silent. Add structured logging.
- [ ] Affects **existing analysis results** in the DB? → May require a backfill or migration.
- [ ] Requires new **GHL Marketplace permissions**? → Requires marketplace app update + review.
- [ ] Runs **inside the GHL iframe**? → Check CSP headers; inline scripts may be blocked.

### Cross-Cutting
- [ ] Does this affect **all agents** or just a subset?
- [ ] Does this need **error handling** for GHL API being down?
- [ ] Does this change the **public API contract** (response shape, new fields)?

## Output Format

Write this summary before handing off to `superpowers:writing-plans`:

```
Feature: <name>
Backend changes: <files / modules>
Frontend changes: <files / components>
GHL API impact: <yes/no — scope + risk>
DB migration: <yes/no>
Risk level: Low | Medium | High
Risk notes: <specific concerns>
Blockers: <unresolved dependencies>
```

## Risk Level Guide

| Level | When |
|---|---|
| **Low** | Pure frontend, no GHL API, no DB schema change |
| **Medium** | New backend route + service, existing GHL scopes |
| **High** | GHL OAuth changes, webhook processing, LLM prompt changes, marketplace permission changes |
