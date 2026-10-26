import { de } from '../i18n/de'

/** German message for a failed Overpass request (HTTP status, invalid JSON, or the raw error). */
export function formatOverpassRunError(error: unknown): string {
  const rawMessage =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error)
  if (rawMessage === 'INVALID_OVERPASS_JSON') return de.feature.liveOsmInvalidJson
  if (rawMessage === 'OVERPASS_TIMEOUT') return de.feature.liveOsmTimeout
  if (rawMessage.startsWith('Overpass request failed:')) {
    return `${de.feature.liveOsmHttp} ${rawMessage.replace('Overpass request failed:', '').trim()}`
  }
  return rawMessage
}
