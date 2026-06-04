---
description: Run Voice AI Copilot test suites (backend + frontend)
argument-hint: [backend|frontend|all]
allowed-tools: Bash(npx:*), Bash(npm:*), Bash(docker:*)
---

Run tests for the Voice AI Observability Copilot.

**Determine scope from argument:**
- `$1` = "backend" → Run backend tests only
- `$1` = "frontend" → Run frontend tests only
- `$1` = "all" or no argument → Run both

**Pre-check:**
If running backend tests, verify the test database is available:
```
docker compose -f voice-ai-copilot/docker-compose.yml up -d postgres_test
```

**Backend tests (Jest):**
```
cd voice-ai-copilot/backend && npx jest --runInBand --no-coverage
```

Note: `--runInBand` is required because tests share the test database.

**Frontend tests (Vitest):**
```
cd voice-ai-copilot/frontend && npx vitest run
```

**After tests complete:**
1. Report pass/fail count for each suite
2. If failures exist, read the failing test file and the source file it tests
3. Suggest specific fixes for failures
4. Do NOT make changes without user approval
