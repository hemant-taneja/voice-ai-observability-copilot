import { sseManager } from '../lib/sse-manager'

export async function broadcastSSE(locationId: string, agentId: string): Promise<void> {
  sseManager.broadcast(locationId, { type: 'analysis.complete', agentId })
}

export async function broadcastSSEFailure(locationId: string, agentId: string): Promise<void> {
  sseManager.broadcast(locationId, { type: 'analysis.failed', agentId })
}
