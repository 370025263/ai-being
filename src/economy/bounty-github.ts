/**
 * GitHub Bounty Source — Discovers bounty-tagged issues on GitHub.
 *
 * Searches GitHub Issues API for issues labeled with "bounty", "reward",
 * or containing /bounty commands. Parses bounty amounts from various
 * formats (Algora, manual /bounty $XX, label-based).
 *
 * Uses native fetch (no SDK dependency).
 */
import type { Opportunity } from '../types.js';
import type { BountySource } from './bounty.js';

const GITHUB_API = 'https://api.github.com';

export class GitHubBountySource implements BountySource {
  name = 'github';
  private token?: string;

  constructor(token?: string) {
    this.token = token;
  }

  async scan(): Promise<Opportunity[]> {
    try {
      const query = encodeURIComponent('label:bounty state:open');
      const url = `${GITHUB_API}/search/issues?q=${query}&sort=created&order=desc&per_page=30`;

      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'ai-being',
      };
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as { items: any[] };
      return data.items.map(issue => this.parseIssue(issue));
    } catch {
      return [];
    }
  }

  private parseIssue(issue: any): Opportunity {
    const body = issue.body ?? '';
    const reward = this.parseReward(body, issue.labels ?? []);
    const repo = this.parseRepo(issue.repository_url ?? '');

    return {
      id: `github_${issue.id}`,
      type: 'bounty',
      description: issue.title,
      estimatedReward: reward,
      estimatedEffort: this.estimateEffort(reward),
      source: `github:${repo}`,
      url: issue.html_url,
    };
  }

  /**
   * Parse bounty amount from issue body and labels.
   * Supports formats:
   *   /bounty $50
   *   💎 Bounty: $100
   *   Label: "$50"
   */
  private parseReward(body: string, labels: Array<{ name: string }>): number {
    // Try /bounty $XX format
    const slashMatch = body.match(/\/bounty\s+\$(\d+(?:\.\d+)?)/i);
    if (slashMatch) return parseFloat(slashMatch[1]);

    // Try "Bounty: $XX" format (Algora)
    const bountyMatch = body.match(/bounty[:\s]+\$(\d+(?:\.\d+)?)/i);
    if (bountyMatch) return parseFloat(bountyMatch[1]);

    // Try label-based: "$XX" labels
    for (const label of labels) {
      const labelMatch = label.name.match(/^\$(\d+(?:\.\d+)?)$/);
      if (labelMatch) return parseFloat(labelMatch[1]);
    }

    return 0;
  }

  private parseRepo(repositoryUrl: string): string {
    // "https://api.github.com/repos/org/repo" → "org/repo"
    const match = repositoryUrl.match(/repos\/(.+)$/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Rough effort estimate: ~1 hour per $10 of bounty.
   */
  private estimateEffort(reward: number): number {
    if (reward <= 0) return 1;
    return Math.max(0.5, reward / 10);
  }
}
