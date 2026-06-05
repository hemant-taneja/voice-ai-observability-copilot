---
description: Start the Voice AI Copilot development environment
allowed-tools: Bash(docker:*), Bash(make:*), Bash(npm:*), Bash(npx:*)
---

Start the full Voice AI Copilot development environment.

**Step 1 — Check infrastructure:**

Verify Docker containers are running:
```
docker compose -f voice-ai-copilot/docker-compose.yml ps
```

If Postgres, Redis, or Temporal are not running, start them:
```
docker compose -f voice-ai-copilot/docker-compose.yml up -d postgres postgres_test redis temporal temporal-ui
```

Wait for health checks to pass.

**Step 2 — Run database migrations:**

```
cd voice-ai-copilot/backend && npx ts-node src/db/migrate.ts
```

**Step 3 — Start development servers:**

```
cd voice-ai-copilot && npx concurrently "cd backend && npm run dev" "cd frontend && npm run dev"
```

**Step 4 — Report status:**

Summarize what is running:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- Temporal UI: http://localhost:8080

If any step fails, report the error and suggest fixes.
