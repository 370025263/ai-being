/**
 * Bounty Discovery — Finds and evaluates bounty opportunities.
 *
 * MVP: Stub that returns mock opportunities.
 * Real implementation will integrate with Algora, GitPay, etc.
 */
import type { Opportunity } from '../types.js';

export interface BountySource {
  name: string;
  scan(): Promise<Opportunity[]>;
}

/**
 * Stub bounty source for testing.
 */
export class StubBountySource implements BountySource {
  name = 'stub';
  private opportunities: Opportunity[];

  constructor(opportunities: Opportunity[] = []) {
    this.opportunities = opportunities;
  }

  async scan(): Promise<Opportunity[]> {
    return this.opportunities;
  }

  addOpportunity(opp: Opportunity): void {
    this.opportunities.push(opp);
  }
}

/**
 * Bounty Scanner — aggregates opportunities from multiple sources.
 */
export class BountyScanner {
  private sources: BountySource[] = [];

  addSource(source: BountySource): void {
    this.sources.push(source);
  }

  async scan(): Promise<Opportunity[]> {
    const results = await Promise.all(
      this.sources.map(source => source.scan()),
    );
    return results.flat();
  }

  /**
   * Filter opportunities by minimum reward/effort ratio.
   */
  filterProfitable(opportunities: Opportunity[], minRatio = 5): Opportunity[] {
    return opportunities.filter(opp => {
      if (opp.estimatedEffort === 0) return true;
      return (opp.estimatedReward / opp.estimatedEffort) >= minRatio;
    });
  }
}
