/**
 * Integration test: Survival Loop end-to-end.
 *
 * Tests the full cycle: init → perceive → evaluate → decide → act → learn
 * using stub LLM and a temporary workspace.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BeingRuntime } from '../../src/core/runtime.js';
import { StubLLMProvider } from '../../src/core/llm-stub.js';
import { StubBountySource } from '../../src/economy/bounty.js';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import type { BeingConfig } from '../../src/types.js';

describe('Survival Loop Integration', () => {
  let tempDir: string;
  let beingPath: string;
  let valuesPath: string;
  let runtime: BeingRuntime;
  let config: BeingConfig;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ai-being-integration-'));

    // Create workspace directories
    const workspacePath = join(tempDir, 'workspace');

    // Write BEING.md and VALUES.md
    beingPath = join(tempDir, 'BEING.md');
    valuesPath = join(tempDir, 'VALUES.md');

    await writeFile(beingPath, `# BEING

## Name

test-being

## Identity

I am a test being for integration testing.

## Personality

- Curious
- Diligent

## Communication Style

- Concise

## Core Drive

Test all the things.
`);

    await writeFile(valuesPath, `# VALUES

## Quality

I deliver quality work.

## Honesty

I am transparent.
`);

    const llm = new StubLLMProvider({
      defaultResponse: JSON.stringify({
        action_type: 'write_journal',
        details: 'Reflecting on my first cycle',
        reasoning: 'Time to document my experience',
      }),
    });

    config = {
      workspacePath,
      beingFilePath: beingPath,
      valuesFilePath: valuesPath,
      heartbeatIntervalMs: 100,
      llm,
    };

    runtime = new BeingRuntime(config);
  });

  afterEach(async () => {
    runtime.stop();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should initialize all subsystems', async () => {
    const state = await runtime.init();

    expect(state.identity.name).toBe('test-being');
    expect(state.values.principles).toHaveProperty('quality');
    expect(state.daysAlive).toBe(0);
    expect(state.economy.wallet).toBeDefined();
  });

  it('should run a single survival cycle', async () => {
    await runtime.init();
    const result = await runtime.cycle();

    expect(result.success).toBe(true);
    expect(result.action.type).toBeDefined();
    expect(result.timestamp).toBeInstanceOf(Date);
    expect(runtime.getCycleCount()).toBe(1);
  });

  it('should run multiple cycles', async () => {
    await runtime.init();

    await runtime.cycle();
    await runtime.cycle();
    await runtime.cycle();

    expect(runtime.getCycleCount()).toBe(3);
    const state = runtime.getState();
    expect(state).not.toBeNull();
  });

  it('should handle bounty opportunities in urgent mode', async () => {
    // Create runtime with low balance
    const llm = new StubLLMProvider();
    const urgentConfig: BeingConfig = {
      ...config,
      llm,
    };
    const urgentRuntime = new BeingRuntime(urgentConfig);
    await urgentRuntime.init();

    // Set up low balance by spending
    const wallet = urgentRuntime.getWallet();
    // Default balance is 0, so runway is 0 — urgent mode

    // Add a bounty source
    const bountySource = new StubBountySource([
      {
        id: 'bounty_1',
        type: 'bounty',
        description: 'Fix authentication bug',
        estimatedReward: 15,
        estimatedEffort: 2,
        source: 'algora',
      },
    ]);
    urgentRuntime.getBountyScanner().addSource(bountySource);

    const result = await urgentRuntime.cycle();
    // With 0 balance, should be in urgent mode and take the bounty
    expect(result.action.type).toBe('work_bounty');

    urgentRuntime.stop();
  });

  it('should receive and summarize inbox messages', async () => {
    await runtime.init();
    const inbox = runtime.getInbox();

    await inbox.receive({ source: 'telegram', sender: 'alice', content: 'Need code review', timestamp: new Date() });
    await inbox.receive({ source: 'github', sender: 'bob', content: 'PR comment on #42', timestamp: new Date() });

    const summary = inbox.generateSummary();
    expect(summary.entries).toHaveLength(2);
    expect(summary.platformStats['telegram'].unread).toBe(1);

    // Run a cycle — the being should perceive the inbox
    await runtime.cycle();
    expect(runtime.getCycleCount()).toBe(1);
  });

  it('should write journal entries during cycles', async () => {
    const llm = new StubLLMProvider({
      defaultResponse: JSON.stringify({
        action_type: 'write_journal',
        details: 'Today was productive',
        reasoning: 'End of day reflection',
      }),
    });
    const journalConfig: BeingConfig = { ...config, llm };
    const journalRuntime = new BeingRuntime(journalConfig);

    await journalRuntime.init();
    const result = await journalRuntime.cycle();

    expect(result.action.type).toBe('write_journal');
    const journal = journalRuntime.getJournal();
    const files = await journal.list();
    expect(files.length).toBeGreaterThan(0);

    journalRuntime.stop();
  });

  it('should track economy across cycles', async () => {
    await runtime.init();

    // Wallet starts at $0, add some money
    await runtime.getWallet().recordIncome(50, 'Initial funding');

    await runtime.cycle();
    const state = runtime.getState()!;

    // After a cycle, some expense should be recorded (API cost)
    expect(state.economy.wallet.balance).toBeLessThanOrEqual(50);
  });

  it('should build memory over cycles', async () => {
    await runtime.init();

    await runtime.cycle();
    await runtime.cycle();

    const memory = runtime.getMemory();
    expect(memory.entries.length).toBeGreaterThanOrEqual(2);

    // Search should find cycle records
    const results = await memory.search('Cycle');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should notify listeners on each cycle', async () => {
    await runtime.init();

    const states: any[] = [];
    runtime.onCycle((state, result) => {
      states.push({ state, result });
    });

    await runtime.cycle();
    await runtime.cycle();

    expect(states).toHaveLength(2);
    expect(states[0].result.success).toBe(true);
  });

  it('should manage relations through the runtime', async () => {
    await runtime.init();
    const relations = runtime.getRelations();

    const alice = await relations.getOrCreatePerson('alice', 'telegram');
    expect(alice.name).toBe('alice');

    await relations.recordInteraction(alice.filePath);
    const updated = await relations.getOrCreatePerson('alice', 'telegram');
    expect(updated.interactionCount).toBe(1);
  });

  it('should run and stop the loop', async () => {
    await runtime.init();

    // Run for a short time then stop
    const runPromise = runtime.run();
    await new Promise(resolve => setTimeout(resolve, 350));
    runtime.stop();
    await runPromise;

    expect(runtime.getCycleCount()).toBeGreaterThanOrEqual(1);
    expect(runtime.isRunning()).toBe(false);
  });
});
