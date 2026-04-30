import { z } from 'zod'
import rawReviewQueue from './reviewQueue.gen'

export type ReviewQueueEntry = {
  canonicalMatchKey: string
  nameLabel: string
  category: 'matched' | 'official_only'
}

export type ReviewQueueArea = {
  area: string
  displayName: string
  reviewEntries: ReviewQueueEntry[]
  issueEntries: ReviewQueueEntry[]
}

const reviewQueueEntrySchema = z.object({
  canonicalMatchKey: z.string().trim().min(1),
  nameLabel: z.string().trim().min(1),
  category: z.enum(['matched', 'official_only']),
})

function parseReviewQueueEntry(raw: unknown): ReviewQueueEntry | null {
  const parsed = reviewQueueEntrySchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

function parseReviewQueueArea(raw: unknown): ReviewQueueArea | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const area = typeof rec.area === 'string' ? rec.area.trim() : ''
  if (!area) return null
  const displayName =
    typeof rec.displayName === 'string' && rec.displayName.trim() !== ''
      ? rec.displayName.trim()
      : area
  const reviewEntries = Array.isArray(rec.reviewEntries)
    ? rec.reviewEntries.map(parseReviewQueueEntry).filter((x): x is ReviewQueueEntry => x != null)
    : []
  const issueEntries = Array.isArray(rec.issueEntries)
    ? rec.issueEntries.map(parseReviewQueueEntry).filter((x): x is ReviewQueueEntry => x != null)
    : []
  return { area, displayName, reviewEntries, issueEntries }
}

function parseReviewQueue(raw: unknown): ReviewQueueArea[] {
  if (!Array.isArray(raw)) return []
  return raw.map(parseReviewQueueArea).filter((x): x is ReviewQueueArea => x != null)
}

export const reviewQueue = parseReviewQueue(rawReviewQueue)
