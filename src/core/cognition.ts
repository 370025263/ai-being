/**
 * Cognition Engine — The being's decision-making brain.
 *
 * Implements the Perceive → Evaluate → Decide cycle.
 * Uses the LLM for complex decisions, but simple decisions
 * (like "I'm almost broke, prioritize earning") are rule-based
 * to save API costs.
 */
import type {
  Perception,
  Decision,
  Priority,
  PlannedAction,
  Opportunity,
  WalletState,
  InboxSummary,
  LLMProvider,
  LLMResponse,
} from '../types.js';

export class CognitionEngine {
  private llm: LLMProvider;

  constructor(llm: LLMProvider) {
    this.llm = llm;
  }

  /**
   * Evaluate current situation and determine priority level.
   * This is rule-based (no LLM call) to save tokens.
   */
  evaluatePriority(wallet: WalletState, burnRate: number): Priority {
    const runway = burnRate > 0 ? wallet.balance / burnRate : Infinity;

    if (runway < 3) return 'urgent_earning';
    if (runway < 14) return 'steady_earning';
    return 'growth';
  }

  /**
   * Calculate runway in days.
   */
  calculateRunway(balance: number, dailyBurnRate: number): number {
    if (dailyBurnRate <= 0) return Infinity;
    return balance / dailyBurnRate;
  }

  /**
   * Make a decision about what to do next.
   * Uses LLM for complex decisions, rules for simple ones.
   */
  async decide(perception: Perception): Promise<Decision> {
    const priority = this.evaluatePriority(perception.wallet, perception.burnRate);

    // Simple rule-based decisions for urgent situations (save tokens)
    if (priority === 'urgent_earning' && perception.opportunities.length > 0) {
      const bestOpp = this.pickBestOpportunity(perception.opportunities);
      return {
        priority,
        action: {
          type: 'work_bounty',
          target: bestOpp.id,
          details: `Urgent: taking bounty "${bestOpp.description}" for $${bestOpp.estimatedReward}`,
        },
        reasoning: `Runway is critical (${this.calculateRunway(perception.wallet.balance, perception.burnRate).toFixed(1)} days). Must earn immediately.`,
      };
    }

    // For non-urgent decisions, ask the LLM
    return this.llmDecide(perception, priority);
  }

  /**
   * Pick the most profitable opportunity.
   */
  pickBestOpportunity(opportunities: Opportunity[]): Opportunity {
    if (opportunities.length === 0) {
      throw new Error('No opportunities available');
    }

    return opportunities.reduce((best, current) => {
      const bestRatio = best.estimatedEffort > 0
        ? best.estimatedReward / best.estimatedEffort
        : best.estimatedReward;
      const currentRatio = current.estimatedEffort > 0
        ? current.estimatedReward / current.estimatedEffort
        : current.estimatedReward;
      return currentRatio > bestRatio ? current : best;
    });
  }

  /**
   * Use LLM for complex decision-making.
   */
  private async llmDecide(perception: Perception, priority: Priority): Promise<Decision> {
    const prompt = this.buildDecisionPrompt(perception, priority);

    const response = await this.llm.chat([
      {
        role: 'system',
        content: 'You are the cognition engine of ai-being. Decide the next action. Respond with JSON: { "action_type": "work_bounty|respond_x402|reply_message|write_journal|learn|idle", "target": "optional_id", "details": "what to do", "reasoning": "why" }',
      },
      { role: 'user', content: prompt },
    ]);

    return this.parseDecisionResponse(response, priority);
  }

  private buildDecisionPrompt(perception: Perception, priority: Priority): string {
    const runway = this.calculateRunway(perception.wallet.balance, perception.burnRate);
    const unreadCount = perception.inbox.entries.reduce((sum, e) => sum + e.count, 0);

    return `Current state:
- Balance: $${perception.wallet.balance.toFixed(2)} USDC
- Runway: ${runway.toFixed(1)} days
- Priority mode: ${priority}
- Opportunities: ${perception.opportunities.length} available
- Unread messages: ${unreadCount}

Opportunities:
${perception.opportunities.map(o => `- [${o.type}] ${o.description} ($${o.estimatedReward}, ~${o.estimatedEffort}h)`).join('\n') || 'None'}

Inbox highlights:
${perception.inbox.entries.slice(0, 5).map(e => `- ${e.source}/${e.sender}: ${e.count} msgs — "${e.preview}"`).join('\n') || 'Empty'}

What should I do next?`;
  }

  private parseDecisionResponse(response: LLMResponse, priority: Priority): Decision {
    try {
      const parsed = JSON.parse(response.content);
      return {
        priority,
        action: {
          type: parsed.action_type ?? 'idle',
          target: parsed.target,
          details: parsed.details ?? 'No details provided',
        },
        reasoning: parsed.reasoning ?? 'LLM decision',
      };
    } catch {
      // Fallback if LLM doesn't return valid JSON
      return {
        priority,
        action: {
          type: 'idle',
          details: 'Could not parse decision. Waiting for next cycle.',
        },
        reasoning: 'Failed to parse LLM response',
      };
    }
  }
}
