import { describe, it, expect } from 'vitest'
import { versionLabel, selectedIndexAfterRefresh } from './agent-detail-versions'
import type { AnalysisVersion } from '../types/analysis.types'

function av(id: string): AnalysisVersion {
  return {
    id,
    overallScore: 1,
    passed: true,
    kpiScores: [],
    summary: '',
    analyzedAt: '2026-06-04T00:00:00Z',
    scriptSuggestions: [],
    useActions: [],
  }
}

describe('versionLabel', () => {
  it('labels the newest (index 0) as the highest number with "(latest)"', () => {
    expect(versionLabel(0, 3)).toBe('v3 (latest)')
  })

  it('labels middle and oldest versions descending without "(latest)"', () => {
    expect(versionLabel(1, 3)).toBe('v2')
    expect(versionLabel(2, 3)).toBe('v1')
  })

  it('labels a single analysis as v1 (latest)', () => {
    expect(versionLabel(0, 1)).toBe('v1 (latest)')
  })
})

describe('selectedIndexAfterRefresh', () => {
  const fresh = [av('a4'), av('a3'), av('a2'), av('a1')] // a4 newest after a re-analysis

  it('follows latest when the user was on the latest version', () => {
    expect(selectedIndexAfterRefresh(0, 'a3', fresh)).toBe(0)
  })

  it('follows latest when there was no prior selection', () => {
    expect(selectedIndexAfterRefresh(0, null, fresh)).toBe(0)
  })

  it('stays on the same analysis (by id) when the user was on an older version', () => {
    // user was reading a2 at old index 2; a4 prepended -> a2 is now index 2 here
    expect(selectedIndexAfterRefresh(2, 'a2', fresh)).toBe(2)
  })

  it('relocates the same id even when its index shifts', () => {
    // user was reading a3 at old index 2; a4 prepended, so a3 is now index 1
    expect(selectedIndexAfterRefresh(2, 'a3', fresh)).toBe(1)
  })

  it('falls back to latest when the previously selected id is gone', () => {
    expect(selectedIndexAfterRefresh(2, 'deleted', fresh)).toBe(0)
  })
})
