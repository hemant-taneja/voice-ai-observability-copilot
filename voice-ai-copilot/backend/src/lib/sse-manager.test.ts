import { SSEManager } from './sse-manager'
import { Response } from 'express'

function mockRes(): jest.Mocked<Partial<Response>> {
  return {
    write: jest.fn(),
    end: jest.fn(),
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
  }
}

describe('SSEManager', () => {
  let manager: SSEManager

  beforeEach(() => { manager = new SSEManager() })

  it('broadcasts an event to all connections for a locationId', () => {
    const res1 = mockRes()
    const res2 = mockRes()
    manager.add('loc-1', res1 as unknown as Response)
    manager.add('loc-1', res2 as unknown as Response)

    manager.broadcast('loc-1', { type: 'analysis.complete', agentId: 'ag-1' })

    const expected = expect.stringContaining('"type":"analysis.complete"')
    expect(res1.write).toHaveBeenCalledWith(expected)
    expect(res2.write).toHaveBeenCalledWith(expected)
  })

  it('does not broadcast to other locations', () => {
    const res1 = mockRes()
    const res2 = mockRes()
    manager.add('loc-1', res1 as unknown as Response)
    manager.add('loc-2', res2 as unknown as Response)

    manager.broadcast('loc-1', { type: 'analysis.complete', agentId: 'ag-1' })

    expect(res1.write).toHaveBeenCalled()
    expect(res2.write).not.toHaveBeenCalled()
  })

  it('removes a connection cleanly', () => {
    const res1 = mockRes()
    manager.add('loc-1', res1 as unknown as Response)
    manager.remove('loc-1', res1 as unknown as Response)

    manager.broadcast('loc-1', { type: 'analysis.complete', agentId: 'ag-1' })

    expect(res1.write).not.toHaveBeenCalled()
  })
})
