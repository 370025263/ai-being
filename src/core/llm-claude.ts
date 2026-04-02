/**
 * Claude LLM Provider — Real Claude API integration.
 *
 * Implements LLMProvider using @anthropic-ai/sdk.
 * Extracts system messages, tracks token usage, estimates costs.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMMessage, LLMResponse } from '../types.js';

// Cost per 1M tokens (blended input+output estimate)
const MODEL_COSTS: Record<string, number> = {
  'claude-opus-4-6': 0.030,     // $30/M tokens blended
  'claude-sonnet-4-6': 0.009,   // $9/M tokens blended
  'claude-haiku-4-5-20251001': 0.002, // $2/M tokens blended
};
const DEFAULT_COST = 0.009;

export class ClaudeLLMProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(apiKey: string, model = 'claude-sonnet-4-6', maxTokens = 4096) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.maxTokens = maxTokens;
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    // Extract system message (Anthropic API takes it as a separate param)
    let systemPrompt: string | undefined;
    const apiMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt = msg.content;
      } else {
        apiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: apiMessages,
    });

    // Extract text content from response blocks
    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    const tokensUsed = (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0);

    return { content, tokensUsed };
  }

  estimateCost(tokens: number): number {
    const costPerToken = (MODEL_COSTS[this.model] ?? DEFAULT_COST) / 1_000_000;
    return tokens * costPerToken;
  }
}
