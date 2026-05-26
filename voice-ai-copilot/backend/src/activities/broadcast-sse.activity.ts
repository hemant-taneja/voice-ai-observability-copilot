import axios from 'axios'
import { config } from '../config'

const baseUrl = `http://127.0.0.1:${config.port}/internal/broadcast`

export async function broadcastSSE(locationId: string, agentId: string): Promise<void> {
  console.log(`[broadcastSSE] posting to ${baseUrl}`, { locationId, agentId })
  const res = await axios.post(baseUrl, { locationId, type: 'analysis.complete', agentId })
  console.log(`[broadcastSSE] response:`, res.status, res.data)
}

export async function broadcastSSEFailure(locationId: string, agentId: string): Promise<void> {
  console.log(`[broadcastSSEFailure] posting to ${baseUrl}`, { locationId, agentId })
  await axios.post(baseUrl, { locationId, type: 'analysis.failed', agentId })
}
