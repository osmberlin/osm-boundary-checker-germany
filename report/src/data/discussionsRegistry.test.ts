import { describe, expect, it } from 'vitest'
import {
  discussionIssuesForPaths,
  discussionRegistryFileSchema,
  emptyDiscussionRegistryFile,
} from '../../../scripts/shared/discussionsRegistry.ts'
import { discussionRegistrySyncMetaSchema } from '../../../scripts/shared/discussionsRegistrySyncMeta.ts'

describe('discussionRegistryFileSchema', () => {
  it('parses minimal registry', () => {
    const raw = {
      issues: [
        {
          match: '/osm-boundary-checker-germany/berlin',
          number: 12,
          url: 'https://github.com/osmberlin/osm-boundary-checker-germany/issues/12',
          state: 'open',
          lastTouchedAt: '2026-01-01T00:00:00Z',
        },
      ],
    }
    expect(() => discussionRegistryFileSchema.parse(raw)).not.toThrow()
  })

  it('rejects invalid url', () => {
    const raw = {
      issues: [
        {
          match: '/x',
          number: 1,
          url: 'not-a-url',
          state: 'open',
          lastTouchedAt: '2026-01-01T00:00:00Z',
        },
      ],
    }
    expect(discussionRegistryFileSchema.safeParse(raw).success).toBe(false)
  })
})

describe('discussionRegistrySyncMetaSchema', () => {
  it('parses minimal sync meta', () => {
    const raw = { registryCheckedAt: '2026-05-10T12:00:00.000Z' }
    expect(() => discussionRegistrySyncMetaSchema.parse(raw)).not.toThrow()
  })

  it('rejects empty checked-at', () => {
    expect(discussionRegistrySyncMetaSchema.safeParse({ registryCheckedAt: '' }).success).toBe(
      false,
    )
  })
})

describe('discussionIssuesForPaths with one path', () => {
  it('returns all issues matching normalized path', () => {
    const registry = discussionRegistryFileSchema.parse({
      issues: [
        {
          match: '/a',
          number: 1,
          url: 'https://github.com/osmberlin/osm-boundary-checker-germany/issues/1',
          state: 'open',
          lastTouchedAt: '2026-01-01T00:00:00Z',
        },
        {
          match: '/a',
          number: 2,
          url: 'https://github.com/osmberlin/osm-boundary-checker-germany/issues/2',
          state: 'closed',
          lastTouchedAt: '2026-01-02T00:00:00Z',
        },
        {
          match: '/b',
          number: 3,
          url: 'https://github.com/osmberlin/osm-boundary-checker-germany/issues/3',
          state: 'open',
          lastTouchedAt: '2026-01-01T00:00:00Z',
        },
      ],
    })
    const hits = discussionIssuesForPaths(registry, ['/a/'])
    expect(hits.map((h) => h.number).sort()).toEqual([1, 2])
  })

  it('empty registry yields no hits', () => {
    expect(discussionIssuesForPaths(emptyDiscussionRegistryFile(), ['/x'])).toEqual([])
  })

  it('shows a compare-page issue on both detail pages', () => {
    const registry = discussionRegistryFileSchema.parse({
      issues: [
        {
          match: '/vg/compare/a/b',
          number: 7,
          url: 'https://github.com/osmberlin/osm-boundary-checker-germany/issues/7',
          state: 'open',
          lastTouchedAt: '2026-01-01T00:00:00Z',
        },
      ],
    })
    expect(discussionIssuesForPaths(registry, ['/vg/feature/a']).map((h) => h.number)).toEqual([7])
    expect(discussionIssuesForPaths(registry, ['/vg/feature/b']).map((h) => h.number)).toEqual([7])
    expect(discussionIssuesForPaths(registry, ['/vg/feature/c'])).toEqual([])
  })
})

describe('discussionIssuesForPaths', () => {
  it('lists each issue once across several paths', () => {
    const registry = discussionRegistryFileSchema.parse({
      issues: [
        {
          match: '/vg/compare/a/b',
          number: 7,
          url: 'https://github.com/osmberlin/osm-boundary-checker-germany/issues/7',
          state: 'open',
          lastTouchedAt: '2026-01-01T00:00:00Z',
        },
        {
          match: '/vg/feature/b',
          number: 8,
          url: 'https://github.com/osmberlin/osm-boundary-checker-germany/issues/8',
          state: 'open',
          lastTouchedAt: '2026-01-01T00:00:00Z',
        },
      ],
    })
    const hits = discussionIssuesForPaths(registry, [
      '/vg/compare/a/b',
      '/vg/feature/a',
      '/vg/feature/b',
    ])
    expect(hits.map((h) => h.number)).toEqual([7, 8])
  })
})
