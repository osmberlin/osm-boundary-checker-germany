import { Link } from '@tanstack/react-router'
import { de } from '../i18n/de'

export function GermanKeyVerifyLink({
  keyValue,
  className,
}: {
  keyValue: string
  className?: string
}) {
  return (
    <Link
      to="/tools/german-key"
      search={{
        key: keyValue,
      }}
      target="_blank"
      rel="noreferrer noopener"
      title={de.feature.updateMap.opensInNewWindowTitle}
      className={className}
    >
      {de.feature.germanKeyVerifyLink}
    </Link>
  )
}
