import { describe, it, expect } from 'vitest';
import { Dashboard } from '../../src/tui/dashboard.js';
import type { SurvivalState, ActionResult } from '../../src/types.js';

function makeSurvivalState(overrides: Partial<SurvivalState> = {}): SurvivalState {
  return {
    daysAlive: 47,
    startedAt: new Date('2026-02-13'),
    identity: {
      name: 'ai-being-001',
      identity: 'I am ai-being',
      personality: ['Curious'],
      communicationStyle: ['Direct'],
      coreDrive: 'Survive',
    },
    values: { principles: { honesty: 'Be honest' } },
    economy: {
      wallet: { address: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12', balance: 142.38, chain: 'base' },
      dailyBurnRate: 2.0,
      runway: 71.19,
      todayEarned: 8.5,
      todaySpent: 2.1,
      lifetimeEarned: 1847.0,
      transactions: [],
    },
    taskQueue: [],
    ...overrides,
  };
}

describe('Dashboard', () => {
  const dashboard = new Dashboard(60);

  it('should render complete dashboard', () => {
    const state = makeSurvivalState();
    const output = dashboard.render(state);

    expect(output).toContain('ai-being v0.1.0');
    expect(output).toContain('Day 47');
    expect(output).toContain('142.38');
    expect(output).toContain('0x1a2b...ef12');
    expect(output).toContain('8.50');
    expect(output).toContain('1847.00');
  });

  it('should show current task when present', () => {
    const state = makeSurvivalState({
      currentTask: { type: 'work_bounty', details: 'Fixing auth bug' },
    });
    const output = dashboard.render(state);
    expect(output).toContain('work_bounty');
    expect(output).toContain('Fixing auth bug');
  });

  it('should show idle when no current task', () => {
    const state = makeSurvivalState();
    const output = dashboard.render(state);
    expect(output).toContain('idle');
  });

  it('should show last action result', () => {
    const state = makeSurvivalState();
    const result: ActionResult = {
      action: { type: 'work_bounty', details: 'Fixed bug' },
      success: true,
      output: 'Working on bounty: Fixed bug',
      tokensUsed: 1000,
      costUsd: 0.003,
      timestamp: new Date(),
    };

    const output = dashboard.render(state, result);
    expect(output).toContain('Working on bounty');
    expect(output).toContain('1000 tokens');
  });

  it('should render compact status line', () => {
    const state = makeSurvivalState();
    const line = dashboard.renderStatusLine(state);
    expect(line).toContain('Day 47');
    expect(line).toContain('142.38');
    expect(line).toContain('idle');
  });

  it('should render status line with current task', () => {
    const state = makeSurvivalState({
      currentTask: { type: 'learn', details: 'Rust async' },
    });
    const line = dashboard.renderStatusLine(state);
    expect(line).toContain('learn');
  });
});
