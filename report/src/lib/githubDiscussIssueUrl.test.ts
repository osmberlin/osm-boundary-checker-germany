import { describe, expect, it } from 'vitest'
import { githubNewDiscussIssueUrl } from './githubDiscussIssueUrl'

describe('githubNewDiscussIssueUrl', () => {
  it('includes discussion label, title, and body', () => {
    const u = githubNewDiscussIssueUrl({
      title: '/path',
      body: 'https://example.com/path?q=1',
    })
    expect(u).toContain('labels=discussion')
    expect(u).toContain(encodeURIComponent('/path'))
    expect(u).toContain(encodeURIComponent('https://example.com/path?q=1'))
    expect(u.startsWith('https://github.com/')).toBe(true)
    expect(u).toContain('/issues/new')
  })
})
