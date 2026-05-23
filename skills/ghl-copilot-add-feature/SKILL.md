---
name: ghl-copilot-add-feature
description: Use when implementing any new feature in the Voice AI Observability Copilot after scope and plan are approved, to follow established Node.js and Vue.js patterns consistently.
---

# Adding Features to the GHL Copilot

## Prerequisites (must be complete before writing code)

1. `superpowers:brainstorming` — design approved by user
2. `ghl-copilot:scope-feature` — scope summary written
3. `superpowers:writing-plans` — implementation plan created and approved

## Backend Pattern (Node.js / Express)

**Rule: Routes are thin. All logic lives in services.**

```js
// src/routes/agents.js — thin handler only
router.get('/:id/recommendations', ghlAuth, async (req, res, next) => {
  try {
    const data = await analysisService.getRecommendations(req.params.id, req.locationId);
    res.json(data);
  } catch (err) {
    next(err); // error middleware handles response
  }
});

// src/services/analysis-service.js — all business logic here
async function getRecommendations(agentId, locationId) {
  const [transcripts, kpis] = await Promise.all([
    transcriptService.findByAgent(agentId),
    kpiService.getConfig(agentId, locationId),
  ]);
  return llmClient.analyze(transcripts, kpis);
}
```

**Never:**
- DB calls in route handlers
- GHL API calls outside `src/lib/ghl-client.js`
- Business logic in middleware

## Frontend Pattern (Vue.js / Pinia)

**Rule: Components read from stores. Stores call the API layer.**

```js
// 1. src/api/analysis.js — axios wrapper
export const analysisApi = {
  getRecommendations: (agentId) => api.get(`/agents/${agentId}/recommendations`),
};

// 2. src/stores/analysis.js — Pinia store
export const useAnalysisStore = defineStore('analysis', () => {
  const recommendations = ref([]);
  const loading = ref(false);

  async function fetchRecommendations(agentId) {
    loading.value = true;
    try {
      recommendations.value = await analysisApi.getRecommendations(agentId);
    } finally {
      loading.value = false;
    }
  }

  return { recommendations, loading, fetchRecommendations };
});

// 3. src/components/RecommendationPanel.vue — consumes store, not API
const store = useAnalysisStore();
onMounted(() => store.fetchRecommendations(props.agentId));
```

**Never:**
- Direct `axios` calls inside `.vue` files
- API calls in `<template>` or `<script setup>` outside of store dispatch
- Duplicating state across multiple stores

## GHL Integration Rules

- Always use `src/lib/ghl-client.js` — never raw `fetch` or `axios` to GHL endpoints
- Always pass `locationId` from the auth context — GHL is multi-tenant
- Token refresh is handled inside `ghl-client.js` — callers don't manage tokens
- Log GHL API errors with `{ locationId, agentId, endpoint }` for debuggability

## Completion Checklist

Before marking any task done:

- [ ] Route added and registered in `src/routes/index.js`
- [ ] Service function handles errors and passes to `next(err)`
- [ ] DB migration file created if schema changed (named `YYYYMMDD-<description>.js`)
- [ ] Pinia store updated with loading + error state
- [ ] API method added to `src/api/<domain>.js`
- [ ] Component reads from store only
- [ ] `CHANGELOG.md` updated via `ghl-copilot:change-log`
- [ ] `superpowers:verification-before-completion` run before claiming done
