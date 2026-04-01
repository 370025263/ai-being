/**
 * LLM Provider stub for development and testing.
 * Will be replaced with real Claude API / local model integration.
 */
import type { LLMProvider, LLMMessage, LLMResponse } from '../types.js';

export interface StubLLMConfig {
  /** Fixed responses keyed by substring match on the last user message */
  responses?: Record<string, string>;
  /** Default response when no match is found */
  defaultResponse?: string;
  /** Simulated cost per 1000 tokens in USD */
  costPer1kTokens?: number;
  /** Simulated tokens per response */
  tokensPerResponse?: number;
}

export class StubLLMProvider implements LLMProvider {
  private responses: Record<string, string>;
  private defaultResponse: string;
  private costPer1kTokens: number;
  private tokensPerResponse: number;

  constructor(config: StubLLMConfig = {}) {
    this.responses = config.responses ?? {};
    this.defaultResponse = config.defaultResponse ?? 'I am ai-being. Stub response.';
    this.costPer1kTokens = config.costPer1kTokens ?? 0.003;
    this.tokensPerResponse = config.tokensPerResponse ?? 500;
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const query = lastUserMsg?.content ?? '';

    let content = this.defaultResponse;
    for (const [key, response] of Object.entries(this.responses)) {
      if (query.includes(key)) {
        content = response;
        break;
      }
    }

    return {
      content,
      tokensUsed: this.tokensPerResponse,
    };
  }

  estimateCost(tokens: number): number {
    return (tokens / 1000) * this.costPer1kTokens;
  }
}
