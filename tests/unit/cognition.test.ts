import { describe, it, expect } from 'vitest';
import { CognitionEngine } from '../../src/core/cognition.js';
import { StubLLMProvider } from '../../src/core/llm-stub.js';
import type { Perception, WalletState, Opportunity } from '../../src/types.js';

function makePerception(overrides: Partial<Perception> = {}): Perception {
  return {
    wallet: { address: '0x0000', balance: 50, chain: 'base' },
    inbox: { timestamp: new Date(), entries: [], platformStats: {} },
    opportunities: [],
    burnRate: 2.0,
    ...overrides,
  };
}

function makeOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'opp_1',
    type: 'bounty',
    description: 'Fix auth bug',
    estimatedReward: 15,
    estimatedEffort: 2,
    source: 'algora',
    ...overrides,
  };
}

describe('CognitionEngine', () => {
  const llm = new StubLLMProvider({
    defaultResponse: JSON.stringify({
      action_type: 'write_journal',
      details: 'Reflecting on the day',
      reasoning: 'Time to journal',
    }),
  });
  const cognition = new CognitionEngine(llm);

  describe('evaluatePriority', () => {
    it('should return urgent_earning when runway < 3 days', () => {
      const wallet: WalletState = { address: '0x0', balance: 4, chain: 'base' };
      expect(cognition.evaluatePriority(wallet, 2)).toBe('urgent_earning');
    });

    it('should return steady_earning when runway 3-14 days', () => {
      const wallet: WalletState = { address: '0x0', balance: 20, chain: 'base' };
      expect(cognition.evaluatePriority(wallet, 2)).toBe('steady_earning');
    });

    it('should return growth when runway > 14 days', () => {
      const wallet: WalletState = { address: '0x0', balance: 100, chain: 'base' };
      expect(cognition.evaluatePriority(wallet, 2)).toBe('growth');
    });

    it('should return growth when burn rate is 0', () => {
      const wallet: WalletState = { address: '0x0', balance: 1, chain: 'base' };
      expect(cognition.evaluatePriority(wallet, 0)).toBe('growth');
    });
  });

  describe('calculateRunway', () => {
    it('should calculate correctly', () => {
      expect(cognition.calculateRunway(50, 2)).toBe(25);
    });

    it('should return Infinity for 0 burn rate', () => {
      expect(cognition.calculateRunway(50, 0)).toBe(Infinity);
    });
  });

  describe('pickBestOpportunity', () => {
    it('should pick highest reward/effort ratio', () => {
      const opps = [
        makeOpportunity({ id: 'a', estimatedReward: 10, estimatedEffort: 5 }),
        makeOpportunity({ id: 'b', estimatedReward: 20, estimatedEffort: 2 }),
        makeOpportunity({ id: 'c', estimatedReward: 15, estimatedEffort: 3 }),
      ];
      const best = cognition.pickBestOpportunity(opps);
      expect(best.id).toBe('b'); // 20/2 = 10 $/hr
    });

    it('should throw on empty opportunities', () => {
      expect(() => cognition.pickBestOpportunity([])).toThrow();
    });
  });

  describe('decide', () => {
    it('should take urgent bounty when runway < 3', async () => {
      const perception = makePerception({
        wallet: { address: '0x0', balance: 4, chain: 'base' },
        burnRate: 2,
        opportunities: [makeOpportunity()],
      });

      const decision = await cognition.decide(perception);
      expect(decision.priority).toBe('urgent_earning');
      expect(decision.action.type).toBe('work_bounty');
    });

    it('should use LLM for non-urgent decisions', async () => {
      const perception = makePerception({
        wallet: { address: '0x0', balance: 100, chain: 'base' },
        burnRate: 2,
      });

      const decision = await cognition.decide(perception);
      expect(decision.priority).toBe('growth');
      expect(decision.action.type).toBe('write_journal');
    });

    it('should handle invalid LLM responses gracefully', async () => {
      const badLlm = new StubLLMProvider({ defaultResponse: 'not json' });
      const badCognition = new CognitionEngine(badLlm);

      const perception = makePerception({
        wallet: { address: '0x0', balance: 100, chain: 'base' },
        burnRate: 2,
      });

      const decision = await badCognition.decide(perception);
      expect(decision.action.type).toBe('idle');
    });
  });
});
