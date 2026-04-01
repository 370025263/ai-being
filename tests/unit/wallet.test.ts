import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Wallet } from '../../src/economy/wallet.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Wallet', () => {
  let tempDir: string;
  let wallet: Wallet;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ai-being-test-'));
    wallet = new Wallet(tempDir, 50.0);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should initialize with given balance', () => {
    expect(wallet.getBalance()).toBe(50.0);
  });

  it('should calculate runway correctly', () => {
    // Default burn rate is $2/day, balance $50
    expect(wallet.getRunway()).toBe(25);
  });

  it('should record income', async () => {
    const tx = await wallet.recordIncome(15.0, 'Bounty payment');
    expect(tx.type).toBe('income');
    expect(tx.amount).toBe(15.0);
    expect(wallet.getBalance()).toBe(65.0);
  });

  it('should record expense', async () => {
    const tx = await wallet.recordExpense(2.5, 'API cost');
    expect(tx.type).toBe('expense');
    expect(wallet.getBalance()).toBe(47.5);
  });

  it('should track daily earned/spent', async () => {
    await wallet.recordIncome(10, 'Job 1');
    await wallet.recordExpense(3, 'API');

    const state = wallet.getState();
    expect(state.todayEarned).toBe(10);
    expect(state.todaySpent).toBe(3);
  });

  it('should track lifetime earned', async () => {
    await wallet.recordIncome(10, 'Job 1');
    await wallet.recordIncome(20, 'Job 2');

    const state = wallet.getState();
    expect(state.lifetimeEarned).toBe(30);
  });

  it('should detect near-death state', async () => {
    expect(wallet.isNearDeath()).toBe(false);

    const bigWallet = new Wallet(tempDir, 0.5);
    expect(bigWallet.isNearDeath()).toBe(true);
  });

  it('should detect urgency', () => {
    // $50 balance, $2/day = 25 days runway — not urgent
    expect(wallet.isUrgent()).toBe(false);

    const urgentWallet = new Wallet(tempDir, 4.0);
    // $4 balance, $2/day = 2 days runway — urgent!
    expect(urgentWallet.isUrgent()).toBe(true);
  });

  it('should reset daily counters', async () => {
    await wallet.recordIncome(10, 'Test');
    await wallet.recordExpense(5, 'Test');
    wallet.resetDaily();

    const state = wallet.getState();
    expect(state.todayEarned).toBe(0);
    expect(state.todaySpent).toBe(0);
    // Balance should NOT be affected
    expect(wallet.getBalance()).toBe(55.0);
  });

  it('should persist and reload from ECONOMY.md', async () => {
    await wallet.recordIncome(25.0, 'Big bounty');

    const wallet2 = new Wallet(tempDir);
    await wallet2.init();
    expect(wallet2.getBalance()).toBe(75.0);
  });
});
