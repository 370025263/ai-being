import { describe, it, expect } from 'vitest';
import { BountyScanner, StubBountySource } from '../../src/economy/bounty.js';
import type { Opportunity } from '../../src/types.js';

describe('BountyScanner', () => {
  it('should aggregate opportunities from multiple sources', async () => {
    const source1 = new StubBountySource([
      { id: '1', type: 'bounty', description: 'Fix bug', estimatedReward: 10, estimatedEffort: 1, source: 'algora' },
    ]);
    const source2 = new StubBountySource([
      { id: '2', type: 'bounty', description: 'Add feature', estimatedReward: 25, estimatedEffort: 3, source: 'gitpay' },
    ]);

    const scanner = new BountyScanner();
    scanner.addSource(source1);
    scanner.addSource(source2);

    const opps = await scanner.scan();
    expect(opps).toHaveLength(2);
  });

  it('should filter by profitability ratio', () => {
    const scanner = new BountyScanner();
    const opps: Opportunity[] = [
      { id: '1', type: 'bounty', description: 'High value', estimatedReward: 50, estimatedEffort: 2, source: 'a' },
      { id: '2', type: 'bounty', description: 'Low value', estimatedReward: 5, estimatedEffort: 5, source: 'b' },
      { id: '3', type: 'bounty', description: 'Medium', estimatedReward: 30, estimatedEffort: 5, source: 'c' },
    ];

    const profitable = scanner.filterProfitable(opps, 5);
    expect(profitable).toHaveLength(2); // id 1 (25$/hr) and 3 (6$/hr)
    expect(profitable.map(o => o.id)).toContain('1');
    expect(profitable.map(o => o.id)).toContain('3');
  });

  it('should include zero-effort opportunities', () => {
    const scanner = new BountyScanner();
    const opps: Opportunity[] = [
      { id: '1', type: 'bounty', description: 'Free money', estimatedReward: 10, estimatedEffort: 0, source: 'a' },
    ];

    const profitable = scanner.filterProfitable(opps, 100);
    expect(profitable).toHaveLength(1);
  });

  it('should return empty when no sources', async () => {
    const scanner = new BountyScanner();
    const opps = await scanner.scan();
    expect(opps).toHaveLength(0);
  });
});
