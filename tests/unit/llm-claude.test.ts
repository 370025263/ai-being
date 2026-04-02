/**
 * TDD: Claude LLM Provider
 *
 * Tests the real Claude API integration with mocked SDK.
 * We mock the Anthropic SDK to avoid real API calls in tests,
 * but the implementation uses the real SDK.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeLLMProvider } from '../../src/core/llm-claude.js';
import type { LLMMessage } from '../../src/types.js';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages: any;
      constructor() {
        this.messages = {
          create: vi.fn(),
        };
      }
    },
  };
});

describe('ClaudeLLMProvider — chat', () => {
  let provider: ClaudeLLMProvider;

  beforeEach(() => {
    provider = new ClaudeLLMProvider('test-api-key', 'claude-sonnet-4-6');
  });

  it('should send messages and return response content', async () => {
    // Set up mock response
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Hello from Claude!' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });
    (provider as any).client.messages.create = mockCreate;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are ai-being.' },
      { role: 'user', content: 'What should I do next?' },
    ];

    const result = await provider.chat(messages);

    expect(result.content).toBe('Hello from Claude!');
    expect(result.tokensUsed).toBe(150); // input + output
  });

  it('should pass model and max_tokens to SDK', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    (provider as any).client.messages.create = mockCreate;

    await provider.chat([{ role: 'user', content: 'test' }]);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
      }),
    );
  });

  it('should extract system message and pass separately', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    (provider as any).client.messages.create = mockCreate;

    await provider.chat([
      { role: 'system', content: 'System prompt here' },
      { role: 'user', content: 'User message' },
    ]);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toBe('System prompt here');
    // Messages should not include system role
    expect(callArgs.messages.every((m: any) => m.role !== 'system')).toBe(true);
    expect(callArgs.messages[0].role).toBe('user');
  });

  it('should handle multi-block content response', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        { type: 'text', text: 'Part 1. ' },
        { type: 'text', text: 'Part 2.' },
      ],
      usage: { input_tokens: 10, output_tokens: 20 },
    });
    (provider as any).client.messages.create = mockCreate;

    const result = await provider.chat([{ role: 'user', content: 'test' }]);
    expect(result.content).toBe('Part 1. Part 2.');
  });
});

describe('ClaudeLLMProvider — error handling', () => {
  let provider: ClaudeLLMProvider;

  beforeEach(() => {
    provider = new ClaudeLLMProvider('test-api-key');
  });

  it('should throw on API error', async () => {
    const mockCreate = vi.fn().mockRejectedValue(new Error('API rate limit exceeded'));
    (provider as any).client.messages.create = mockCreate;

    await expect(
      provider.chat([{ role: 'user', content: 'test' }]),
    ).rejects.toThrow('API rate limit exceeded');
  });

  it('should handle empty content response', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [],
      usage: { input_tokens: 10, output_tokens: 0 },
    });
    (provider as any).client.messages.create = mockCreate;

    const result = await provider.chat([{ role: 'user', content: 'test' }]);
    expect(result.content).toBe('');
    expect(result.tokensUsed).toBe(10);
  });
});

describe('ClaudeLLMProvider — cost estimation', () => {
  it('should estimate cost for sonnet model', () => {
    const provider = new ClaudeLLMProvider('key', 'claude-sonnet-4-6');
    const cost = provider.estimateCost(1000);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(0.1); // Should be reasonable
  });

  it('should estimate higher cost for opus model', () => {
    const sonnet = new ClaudeLLMProvider('key', 'claude-sonnet-4-6');
    const opus = new ClaudeLLMProvider('key', 'claude-opus-4-6');

    expect(opus.estimateCost(1000)).toBeGreaterThan(sonnet.estimateCost(1000));
  });

  it('should return 0 cost for 0 tokens', () => {
    const provider = new ClaudeLLMProvider('key');
    expect(provider.estimateCost(0)).toBe(0);
  });
});
