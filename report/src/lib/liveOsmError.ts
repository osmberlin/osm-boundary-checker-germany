import { de } from '../i18n/de'
import {
  POSTPASS_HTTP_ERROR_PREFIX,
  POSTPASS_INVALID_RESPONSE,
  POSTPASS_TIMEOUT,
  POSTPASS_TOO_MUCH_DATA,
} from './postpass'

/** German message for a failed Postpass request (HTTP status, invalid response, timeout, or the raw error). */
export function formatLiveOsmError(error: unknown): string {
  const rawMessage =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error)
  if (rawMessage === POSTPASS_INVALID_RESPONSE) return de.feature.liveOsmInvalidJson
  if (rawMessage === POSTPASS_TIMEOUT) return de.feature.liveOsmTimeout
  if (rawMessage === POSTPASS_TOO_MUCH_DATA) return de.feature.liveOsmTooMuchData
  if (rawMessage.startsWith(POSTPASS_HTTP_ERROR_PREFIX)) {
    return `${de.feature.liveOsmHttp} ${rawMessage.replace(POSTPASS_HTTP_ERROR_PREFIX, '').trim()}`
  }
  return rawMessage
}
