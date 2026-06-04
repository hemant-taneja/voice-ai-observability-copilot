---
description: Sync Voice AI agents from GoHighLevel for a location
argument-hint: [location-id]
allowed-tools: Bash(curl:*), Bash(npx:*), Read
---

Sync Voice AI agents from the GoHighLevel API into the local database.

**Determine location ID:**
- If `$1` is provided, use it as the locationId
- If no argument, use the demo location: `demo-location-001`

**Sync agents:**

```
curl -s -X POST "http://localhost:3000/api/agents/sync?locationId=$1" | python3 -m json.tool 2>/dev/null || curl -s -X POST "http://localhost:3000/api/agents/sync?locationId=$1"
```

**After sync:**
1. Report the number of agents synced
2. List agent names and IDs
3. If the sync fails with 401, explain that GHL OAuth tokens may be expired and the user needs to re-install the marketplace app or check their `.env` credentials
4. If the sync fails with a connection error, suggest checking that the backend server is running on port 3000

**Verify agents exist:**

```
curl -s "http://localhost:3000/api/agents?locationId=$1" | python3 -m json.tool 2>/dev/null || curl -s "http://localhost:3000/api/agents?locationId=$1"
```

Report the current agent list for the location.
