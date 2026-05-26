import axios from 'axios'
import { config } from '../config'

const baseUrl = `http://127.0.0.1:${config.port}/internal/broadcast`

export async function broadcastSSE(locationId: string, agentId: string): Promise<void> {
  await axios.post(baseUrl, { locationId, type: 'analysis.complete', agentId })
}

export async function broadcastSSEFailure(locationId: string, agentId: string): Promise<void> {
  await axios.post(baseUrl, { locationId, type: 'analysis.failed', agentId })
}
