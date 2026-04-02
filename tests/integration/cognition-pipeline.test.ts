/**
 * Integration test: Cognition Pipeline
 *
 * Verifies the full thinking flow:
 *   Perception → CognitionEngine (LLM) → Decision → Action → Memory
 *
 * Tests the contract between CognitionEngine, MemorySystem, Journal, and the runtime cycle.
 * Uses StubLLMProvider to deterministically control decisions.
 * This test is stable — it tests cross-module contracts, not implementation details.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CognitionEngine } from '../../src/core/cognition.js';
import { MemorySystem } from '../../src/core/memory.js';
import { Journal } from '../../src/identity/journal.js';
import { StubLLMProvider } from '../../src/core/llm-stub.js';
import type { Perception, WalletState } from '../../src/types.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function makeWallet(overrides: Partial<WalletState> = {}): WalletState {
  return { address: '0xtest', balance: 50, chain: 'base', ...overrides };
}

function makePerception(overrides: Partial<Perception> = {}): Perception {
  return {
    wallet: makeWallet(),
    inbox: { entries: [], totalUnread: 0, platformStats: {} },
    opportunities: [],
    burnRate: 1.5,
    ...overrides,
  };
}

describe('Integration: Cognition Pipeline (Perceive → Decide → Act → Remember)', () => {
  let tempDir: string;
  let memory: MemorySystem;
  let journal: Journal;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ai-being-integ-cognition-'));
    memory = new MemorySystem(tempDir);
    journal = new Journal(tempDir);
    await memory.init();
    await journal.init();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('end-to-end: perception → LLM decision → correct action type', async () => {
    const llm = new StubLLMProvider({
      defaultResponse: JSON.stringify({
        action_type: 'work_bounty',
        target: 'bounty_123',
        details: 'Working on authentication fix',
        reasoning: 'Low balance, need to earn money',
      }),
    });
    const cognition = new CognitionEngine(llm);

    const perception = makePerception({
      opportunities: [{
        id: 'bounty_123', type: 'bounty', description: 'Fix auth bug',
        estimatedReward: 30, estimatedEffort: 2, source: 'algora',
      }],
    });

    const decision = await cognition.decide(perception);

    expect(decision.action.type).toBe('work_bounty');
    expect(decision.action.target).toBe('bounty_123');
    expect(decision.reasoning).toBeDefined();
  });

  it('end-to-end: decision → journal write → persisted to disk', async () => {
    const entryContent = 'Day 5: Completed my first bounty. Earned $30 USDC.';
    await journal.write(entryContent);

    const entries = await journal.list();
    expect(entries.length).toBeGreaterThan(0);

    const latest = await journal.read(entries[0]);
    expect(latest).toContain('first bounty');
  });

  it('end-to-end: action result → stored in memory → searchable', async () => {
    await memory.add({
      filePath: 'virtual/action_results.md',
      lineOffset: 0,
      summary: 'Completed bounty fix-auth-bug, earned $30',
      timestamp: new Date(),
    });

    await memory.add({
      filePath: 'virtual/action_results.md',
      lineOffset: 10,
      summary: 'Replied to Alice on Telegram about code review',
      timestamp: new Date(),
    });

    const bountyResults = await memory.search('bounty');
    expect(bountyResults.length).toBeGreaterThan(0);
    expect(bountyResults[0].summary).toContain('fix-auth-bug');

    const socialResults = await memory.search('Telegram');
    expect(socialResults.length).toBeGreaterThan(0);
    expect(socialResults[0].summary).toContain('Alice');
  });

  it('end-to-end: multiple cycles → memory accumulates → reflects history', async () => {
    const llm = new StubLLMProvider({
      defaultResponse: JSON.stringify({
        action_type: 'write_journal',
        details: 'Cycle reflection',
        reasoning: 'Documenting progress',
      }),
    });
    const cognition = new CognitionEngine(llm);

    for (let i = 1; i <= 3; i++) {
      const perception = makePerception({ burnRate: 1.5 * i });
      const decision = await cognition.decide(perception);

      await memory.add({
        filePath: `virtual/cycle_${i}.md`,
        lineOffset: 0,
        summary: `Cycle ${i}: decided to ${decision.action.type} — ${decision.action.details}`,
        timestamp: new Date(),
      });
    }

    expect(memory.entries.length).toBeGreaterThanOrEqual(3);

    const results = await memory.search('Cycle');
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it('end-to-end: urgent perception → rule-based bounty selection (no LLM)', async () => {
    const llm = new StubLLMProvider();
    const cognition = new CognitionEngine(llm);

    // Balance critically low → urgent_earning → rule-based path
    const perception = makePerception({
      wallet: makeWallet({ balance: 2 }),
      opportunities: [{
        id: 'bounty_urgent', type: 'bounty', description: 'Quick fix',
        estimatedReward: 10, estimatedEffort: 0.5, source: 'github',
      }],
      burnRate: 2,
    });

    const decision = await cognition.decide(perception);
    expect(decision.action.type).toBe('work_bounty');
    expect(decision.priority).toBe('urgent_earning');
  });
});
