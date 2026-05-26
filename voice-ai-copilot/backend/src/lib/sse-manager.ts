import { Response } from 'express'

export interface SSEEvent {
  type: 'analysis.complete' | 'analysis.failed' | 'transcript.ingested'
  agentId: string
  [key: string]: unknown
}

export class SSEManager {
  private connections = new Map<string, Set<Response>>()

  add(locationId: string, res: Response): void {
    if (!this.connections.has(locationId)) {
      this.connections.set(locationId, new Set())
    }
    this.connections.get(locationId)!.add(res)
  }

  remove(locationId: string, res: Response): void {
    this.connections.get(locationId)?.delete(res)
  }

  broadcast(locationId: string, event: SSEEvent): void {
    const clients = this.connections.get(locationId)
    console.log(`[sseManager] broadcast → locationId=${locationId} type=${event.type} clients=${clients?.size ?? 0}`)
    if (!clients?.size) return

    const data = `data: ${JSON.stringify(event)}\n\n`
    for (const res of clients) {
      try {
        res.write(data)
        console.log(`[sseManager] wrote event to client`)
      } catch (err) {
        console.log(`[sseManager] write failed, removing client:`, err)
        this.remove(locationId, res)
      }
    }
  }
}

// Singleton used across the app
export const sseManager = new SSEManager()
