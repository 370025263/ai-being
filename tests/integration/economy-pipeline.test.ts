/**
 * Integration test: Economy Pipeline
 *
 * Verifies the full economic flow:
 *   Bounty discovery → opportunity evaluation → wallet expense tracking → cost accounting
 *
 * Tests the contract between BountyScanner, GitHubBountySource, Wallet, and LLM cost estimation.
 * Uses mocked fetch to avoid real GitHub API calls.
 * This test is stable — it tests cross-module contracts, not implementation details.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BountyScanner, StubBountySource } from '../../src/economy/bounty.js';
import { GitHubBountySource } from '../../src/economy/bounty-github.js';
import { Wallet } from '../../src/economy/wallet.js';
import { StubLLMProvider } from '../../src/core/llm-stub.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock fetch for GitHub API
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Integration: Economy Pipeline (Bounty → Wallet → Cost)', () => {
  let tempDir: string;
  let wallet: Wallet;
  let llm: StubLLMProvider;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ai-being-integ-econ-'));
    wallet = new Wallet(tempDir, 100); // Start with $100
    await wallet.init();
    llm = new StubLLMProvider();
    mockFetch.mockReset();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('end-to-end: scan bounties from multiple sources → unified list', async () => {
    // Source 1: Stub with known opportunities
    const stubSource = new StubBountySource([
      {
        id: 'stub_1', type: 'bounty', description: 'Fix CSS layout',
        estimatedReward: 20, estimatedEffort: 1, source: 'algora',
      },
    ]);

    // Source 2: GitHub (mocked)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{
          id: 999, title: 'Implement OAuth2',
          html_url: 'https://github.com/org/repo/issues/99',
          body: '/bounty $50',
          labels: [{ name: 'bounty' }],
          repository_url: 'https://api.github.com/repos/org/repo',
        }],
      }),
    });
    const githubSource = new GitHubBountySource();

    // Aggregate via BountyScanner
    const scanner = new BountyScanner();
    scanner.addSource(stubSource);
    scanner.addSource(githubSource);

    const opportunities = await scanner.scan();

    expect(opportunities).toHaveLength(2);
    expect(opportunities[0].source).toBe('algora');
    expect(opportunities[1].source).toBe('github:org/repo');
    expect(opportunities[1].estimatedReward).toBe(50);
  });

  it('end-to-end: filter profitable bounties by reward/effort ratio', async () => {
    const scanner = new BountyScanner();
    scanner.addSource(new StubBountySource([
      { id: 'b1', type: 'bounty', description: 'Easy task', estimatedReward: 30, estimatedEffort: 1, source: 'test' },
      { id: 'b2', type: 'bounty', description: 'Hard task', estimatedReward: 10, estimatedEffort: 5, source: 'test' },
      { id: 'b3', type: 'bounty', description: 'Medium task', estimatedReward: 50, estimatedEffort: 8, source: 'test' },
    ]));

    const allOpps = await scanner.scan();
    const profitable = scanner.filterProfitable(allOpps, 5);

    // b1 (30/1=30) and b3 (50/8=6.25) pass ratio >= 5; b2 (10/5=2) does not
    expect(profitable).toHaveLength(2);
    expect(profitable.map((o) => o.id)).toContain('b1');
    expect(profitable.map((o) => o.id)).toContain('b3');
  });

  it('end-to-end: working a bounty → expense recorded → balance decreases', async () => {
    const initialBalance = wallet.getBalance();
    expect(initialBalance).toBe(100);

    // Simulate working on a bounty (LLM API call cost)
    const tokensUsed = 2000;
    const cost = llm.estimateCost(tokensUsed);
    await wallet.recordExpense(cost, 'API cost for bounty work');

    // Balance should decrease
    expect(wallet.getBalance()).toBeLessThan(initialBalance);

    // Economy state tracks via transactions
    const state = wallet.getState();
    const expenses = state.transactions.filter((t) => t.type === 'expense');
    expect(expenses.length).toBeGreaterThanOrEqual(1);
    expect(expenses[0].description).toContain('bounty');
  });

  it('end-to-end: earning bounty reward → income recorded → balance increases', async () => {
    // Simulate earning from a completed bounty
    await wallet.recordIncome(50, 'Bounty reward: Fix CSS layout');
    const state = wallet.getState();

    expect(wallet.getBalance()).toBe(150); // 100 initial + 50 reward
    const incomes = state.transactions.filter((t) => t.type === 'income');
    expect(incomes.length).toBeGreaterThanOrEqual(1);
    expect(incomes[0].description).toContain('Bounty reward');
  });

  it('end-to-end: low balance triggers urgent mode → affects runway', async () => {
    // Drain the wallet
    await wallet.recordExpense(95, 'Large expense');
    expect(wallet.getBalance()).toBe(5);

    // Should be in urgent mode
    expect(wallet.isUrgent()).toBe(true);

    // Runway should be very short
    const runway = wallet.getRunway();
    expect(runway).toBeLessThan(30); // Less than 30 days
  });

  it('end-to-end: wallet state integrates with perception', async () => {
    // Record some activity
    await wallet.recordIncome(25, 'Small bounty');
    await wallet.recordExpense(5, 'API cost');

    // WalletState should reflect everything
    const walletState = wallet.getWalletState();
    expect(walletState.balance).toBe(120); // 100 + 25 - 5
    expect(walletState.address).toBeDefined();
    expect(walletState.chain).toBe('base');
  });
});
