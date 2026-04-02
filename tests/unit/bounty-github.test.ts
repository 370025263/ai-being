/**
 * TDD: GitHub Bounty Source
 *
 * Tests discovery and parsing of bounty-tagged GitHub issues.
 * Mocks the fetch API to avoid real GitHub calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubBountySource } from '../../src/economy/bounty-github.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockGitHubResponse(items: any[]) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ items }),
  });
}

function mockGitHubError(status: number, message: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: message,
  });
}

describe('GitHubBountySource — scan for bounties', () => {
  let source: GitHubBountySource;

  beforeEach(() => {
    source = new GitHubBountySource();
    mockFetch.mockReset();
  });

  it('should find issues labeled with bounty', async () => {
    mockGitHubResponse([
      {
        id: 1,
        title: 'Fix authentication bypass',
        html_url: 'https://github.com/org/repo/issues/42',
        body: 'This needs fixing.\n\n/bounty $50',
        labels: [{ name: 'bounty' }],
        repository_url: 'https://api.github.com/repos/org/repo',
      },
    ]);

    const opps = await source.scan();
    expect(opps).toHaveLength(1);
    expect(opps[0].type).toBe('bounty');
    expect(opps[0].description).toContain('Fix authentication bypass');
    expect(opps[0].url).toBe('https://github.com/org/repo/issues/42');
  });

  it('should parse bounty amount from /bounty command', async () => {
    mockGitHubResponse([
      {
        id: 2,
        title: 'Add dark mode',
        html_url: 'https://github.com/org/repo/issues/10',
        body: 'Please add dark mode support\n\n/bounty $25',
        labels: [{ name: 'bounty' }],
        repository_url: 'https://api.github.com/repos/org/repo',
      },
    ]);

    const opps = await source.scan();
    expect(opps[0].estimatedReward).toBe(25);
  });

  it('should parse bounty amount from Algora format', async () => {
    mockGitHubResponse([
      {
        id: 3,
        title: 'Refactor database layer',
        html_url: 'https://github.com/org/repo/issues/5',
        body: '💎 Bounty: $100\n\nRefactor the database layer',
        labels: [{ name: 'bounty' }, { name: '$100' }],
        repository_url: 'https://api.github.com/repos/org/repo',
      },
    ]);

    const opps = await source.scan();
    expect(opps[0].estimatedReward).toBe(100);
  });

  it('should default reward to 0 when amount not parseable', async () => {
    mockGitHubResponse([
      {
        id: 4,
        title: 'Some issue',
        html_url: 'https://github.com/org/repo/issues/1',
        body: 'No bounty amount specified',
        labels: [{ name: 'bounty' }],
        repository_url: 'https://api.github.com/repos/org/repo',
      },
    ]);

    const opps = await source.scan();
    expect(opps[0].estimatedReward).toBe(0);
  });

  it('should handle multiple bounties', async () => {
    mockGitHubResponse([
      {
        id: 10, title: 'Issue A', html_url: 'https://github.com/a/b/issues/1',
        body: '/bounty $10', labels: [{ name: 'bounty' }],
        repository_url: 'https://api.github.com/repos/a/b',
      },
      {
        id: 11, title: 'Issue B', html_url: 'https://github.com/c/d/issues/2',
        body: '/bounty $20', labels: [{ name: 'bounty' }],
        repository_url: 'https://api.github.com/repos/c/d',
      },
    ]);

    const opps = await source.scan();
    expect(opps).toHaveLength(2);
    expect(opps[0].estimatedReward).toBe(10);
    expect(opps[1].estimatedReward).toBe(20);
  });

  it('should extract source repo from repository_url', async () => {
    mockGitHubResponse([
      {
        id: 5, title: 'Test', html_url: 'https://github.com/myorg/myrepo/issues/1',
        body: '/bounty $5', labels: [{ name: 'bounty' }],
        repository_url: 'https://api.github.com/repos/myorg/myrepo',
      },
    ]);

    const opps = await source.scan();
    expect(opps[0].source).toBe('github:myorg/myrepo');
  });

  it('should return empty array on no results', async () => {
    mockGitHubResponse([]);
    const opps = await source.scan();
    expect(opps).toHaveLength(0);
  });
});

describe('GitHubBountySource — error handling', () => {
  let source: GitHubBountySource;

  beforeEach(() => {
    source = new GitHubBountySource();
    mockFetch.mockReset();
  });

  it('should return empty array on API error', async () => {
    mockGitHubError(403, 'Rate limited');
    const opps = await source.scan();
    expect(opps).toHaveLength(0);
  });

  it('should return empty array on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const opps = await source.scan();
    expect(opps).toHaveLength(0);
  });
});

describe('GitHubBountySource — effort estimation', () => {
  let source: GitHubBountySource;

  beforeEach(() => {
    source = new GitHubBountySource();
    mockFetch.mockReset();
  });

  it('should estimate effort based on bounty size', async () => {
    mockGitHubResponse([
      {
        id: 20, title: 'Small fix', html_url: 'https://github.com/a/b/issues/1',
        body: '/bounty $10', labels: [{ name: 'bounty' }],
        repository_url: 'https://api.github.com/repos/a/b',
      },
      {
        id: 21, title: 'Big feature', html_url: 'https://github.com/a/b/issues/2',
        body: '/bounty $200', labels: [{ name: 'bounty' }],
        repository_url: 'https://api.github.com/repos/a/b',
      },
    ]);

    const opps = await source.scan();
    // Higher bounty = more estimated effort
    expect(opps[1].estimatedEffort).toBeGreaterThan(opps[0].estimatedEffort);
  });
});
