import { de } from '../i18n/de'
import type { OsmPipelineState } from '../types/osmPipelineState'
import type { RunStatusBranch } from '../types/runStatus'

export type OsmDownloadAlertKind = 'failed' | 'fallback' | 'streak_warning'

export type OsmDownloadAlert = {
  kind: OsmDownloadAlertKind
  title: string
  detail: string
}

function sourceOriginLabel(origin: RunStatusBranch['sourceOrigin']): string {
  switch (origin) {
    case 'fresh':
      return de.status.osmSourceOriginFresh
    case 'cache_window':
      return de.status.osmSourceOriginCacheWindow
    case 'fallback_artifact':
      return de.status.osmSourceOriginFallback
    default:
      return de.status.osmSourceOriginUnknown
  }
}

export function buildOsmDownloadAlert(params: {
  osmBranch?: RunStatusBranch
  pipelineState: OsmPipelineState | null
}): OsmDownloadAlert | null {
  const { osmBranch, pipelineState } = params
  const streak = pipelineState?.consecutiveFallbackRuns ?? 0

  if (osmBranch?.status === 'failed_no_cache') {
    return {
      kind: 'failed',
      title: de.status.osmAlertFailedTitle,
      detail:
        osmBranch.errorMessage ??
        pipelineState?.lastErrorMessage ??
        de.status.osmAlertFailedDetailFallback,
    }
  }

  if (osmBranch?.sourceOrigin === 'fallback_artifact' || streak > 0) {
    const origin = sourceOriginLabel(osmBranch?.sourceOrigin)
    const errorLine = osmBranch?.errorMessage ?? pipelineState?.lastErrorMessage
    const streakLine =
      streak > 0
        ? de.status.osmAlertFallbackStreak.replace('{count}', String(streak)).replace('{max}', '2')
        : null
    const detailParts = [
      de.status.osmAlertFallbackDetail.replace('{origin}', origin),
      errorLine ? de.status.osmAlertFreshAttemptError.replace('{error}', errorLine) : null,
      streakLine,
    ].filter(Boolean)
    return {
      kind: streak >= 2 ? 'streak_warning' : 'fallback',
      title: de.status.osmAlertFallbackTitle,
      detail: detailParts.join(' '),
    }
  }

  return null
}
