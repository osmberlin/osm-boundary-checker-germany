import type { OsmDownloadAlert } from '../../lib/osmDownloadStatus'

const toneClasses: Record<OsmDownloadAlert['kind'], string> = {
  failed: 'border-rose-900/50 bg-rose-950/30 text-rose-100',
  fallback: 'border-amber-900/50 bg-amber-950/30 text-amber-100',
  streak_warning: 'border-orange-900/50 bg-orange-950/30 text-orange-100',
}

export function OsmDownloadAlertBanner({ alert }: { alert: OsmDownloadAlert }) {
  return (
    <div
      className={`mb-6 rounded-lg border px-4 py-3 ${toneClasses[alert.kind]}`}
      role="status"
      aria-live="polite"
    >
      <p className="font-medium">{alert.title}</p>
      <p className="mt-1 text-sm text-pretty opacity-90">{alert.detail}</p>
    </div>
  )
}
