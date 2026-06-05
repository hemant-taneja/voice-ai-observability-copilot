---
name: ghl-copilot-add-feature
description: This skill should be used when implementing any new feature in the Voice AI Observability Copilot after scope and plan are approved. Also triggers when the user says "implement this feature", "build this", "add this endpoint", "create this component", or needs to follow established Node.js/Express and Vue 3/Pinia patterns consistently.
---

# Adding Features to the GHL Copilot

## Prerequisites (must be complete before writing code)

1. `superpowers:brainstorming` — design approved by user
2. `ghl-copilot:ghl-copilot-scope-feature` — scope summary written
3. `superpowers:writing-plans` — implementation plan created and approved

## Backend Pattern (Node.js / Express / TypeScript)

**Rule: Routes are thin. All logic lives in services.**

```typescript
// backend/src/routes/agents.ts — thin handler only
router.get('/:id/recommendations', ghlAuth(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locationId } = (req as GHLRequest).ghlContext;
    const data = await agentsService.getRecommendations(req.params.id, locationId);
    res.json(data);
  } catch (err) {
    next(err); // error middleware handles response
  }
});

// backend/src/services/agents-service.ts — all business logic here
async function getRecommendations(agentId: string, locationId: string) {
  const [transcripts, kpis] = await Promise.all([
    db.query('SELECT * FROM transcripts WHERE agent_id = $1', [agentId]),
    db.query('SELECT * FROM kpi_configs WHERE agent_id = $1', [agentId]),
  ]);
  return { transcripts: transcripts.rows, kpis: kpis.rows };
}
```

**Never:**
- DB calls in route handlers
- GHL API calls outside `backend/src/lib/ghl-client.ts`
- LLM calls outside `backend/src/lib/llm/`
- Business logic in middleware
- Direct `axios` or `fetch` to external APIs

## Frontend Pattern (Vue 3 / Pinia / Composition API)

**Rule: Components read from stores. Stores call the API layer.**

```typescript
// 1. frontend/src/api/analysis.ts — axios wrapper
export const analysisApi = {
  getRecommendations: (agentId: string) =>
    api.get(`/agents/${agentId}/recommendations`).then(r => r.data),
};

// 2. frontend/src/stores/analysis.ts — Pinia store
export const useAnalysisStore = defineStore('analysis', () => {
  const recommendations = ref([]);
  const loading = ref(false);

  async function fetchRecommendations(agentId: string) {
    loading.value = true;
    try {
      recommendations.value = await analysisApi.getRecommendations(agentId);
    } finally {
      loading.value = false;
    }
  }

  return { recommendations, loading, fetchRecommendations };
});

// 3. frontend/src/components/RecommendationPanel.vue — consumes store, not API
const store = useAnalysisStore();
onMounted(() => store.fetchRecommendations(props.agentId));
```

**Never:**
- Direct `axios` calls inside `.vue` files
- API calls in `<template>` or `<script setup>` outside of store dispatch
- Duplicating state across multiple stores

## GHL Integration Rules

- Always use `backend/src/lib/ghl-client.ts` — never raw `fetch` or `axios` to GHL endpoints
- Always pass `locationId` from the auth context — GHL is multi-tenant
- Token refresh is handled inside `ghl-client.ts` — callers don't manage tokens
- Log GHL API errors with `{ locationId, agentId, endpoint }` for debuggability

## Temporal Activity Rules

- New activities go in `backend/src/activities/<name>.activity.ts`
- Export from `backend/src/activities/index.ts`
- Register in `backend/src/workers/temporal-worker.ts`
- Set retry policies matching existing patterns (see `ghl-copilot-temporal` skill)

## Database Migration Rules

- New migrations: `backend/src/db/migrations/NNN_<description>.sql` (next number after 003)
- Use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`
- Run via `make migrate` or `npm run migrate` from backend/

## Completion Checklist

Before marking any task done:

- [ ] Route added and registered in `backend/src/routes/index.ts`
- [ ] Service function handles errors and passes to `next(err)`
- [ ] DB migration file created if schema changed
- [ ] Pinia store updated with loading + error state
- [ ] API method added to `frontend/src/api/<domain>.ts`
- [ ] Component reads from store only
- [ ] Tests added (Jest for backend, Vitest for frontend)
- [ ] `CHANGELOG.md` updated via `ghl-copilot:ghl-copilot-change-log`
- [ ] `superpowers:verification-before-completion` run before claiming done
