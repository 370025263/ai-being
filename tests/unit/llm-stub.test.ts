import { describe, it, expect } from 'vitest';
import { StubLLMProvider } from '../../src/core/llm-stub.js';

describe('StubLLMProvider', () => {
  it('should return default response', async () => {
    const llm = new StubLLMProvider({ defaultResponse: 'Hello world' });
    const res = await llm.chat([{ role: 'user', content: 'anything' }]);
    expect(res.content).toBe('Hello world');
    expect(res.tokensUsed).toBe(500);
  });

  it('should match responses by substring', async () => {
    const llm = new StubLLMProvider({
      responses: {
        'bounty': 'Taking the bounty',
        'journal': 'Writing journal',
      },
      defaultResponse: 'default',
    });

    const res1 = await llm.chat([{ role: 'user', content: 'Find a bounty' }]);
    expect(res1.content).toBe('Taking the bounty');

    const res2 = await llm.chat([{ role: 'user', content: 'Write journal' }]);
    expect(res2.content).toBe('Writing journal');

    const res3 = await llm.chat([{ role: 'user', content: 'Do something else' }]);
    expect(res3.content).toBe('default');
  });

  it('should estimate cost', () => {
    const llm = new StubLLMProvider({ costPer1kTokens: 0.01 });
    expect(llm.estimateCost(1000)).toBe(0.01);
    expect(llm.estimateCost(5000)).toBe(0.05);
  });

  it('should use last user message for matching', async () => {
    const llm = new StubLLMProvider({
      responses: { 'help': 'Helping you' },
      defaultResponse: 'default',
    });

    const res = await llm.chat([
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'I need help' },
    ]);
    expect(res.content).toBe('Helping you');
  });
});
