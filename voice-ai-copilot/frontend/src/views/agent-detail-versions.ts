import type { AnalysisVersion } from '../types/analysis.types'

// `analyses` is sorted newest-first, so array index and human version number run
// in opposite directions: index 0 is the newest and gets the highest number.
export function versionLabel(index: number, total: number): string {
  const n = total - index
  return index === 0 ? `v${n} (latest)` : `v${n}`
}

// After an SSE-triggered refetch, decide which version index to show.
// - prevIndex 0 (or no prior selection): follow latest (a newly completed
//   re-analysis prepends at index 0, so 0 still points at "latest").
// - otherwise: keep showing the SAME analysis the user navigated to, relocated
//   by its stable id (its index may have shifted as versions prepended).
export function selectedIndexAfterRefresh(
  prevIndex: number,
  prevId: string | null,
  freshAnalyses: AnalysisVersion[],
): number {
  if (prevIndex === 0 || !prevId) return 0
  const i = freshAnalyses.findIndex((a) => a.id === prevId)
  return i >= 0 ? i : 0
}
