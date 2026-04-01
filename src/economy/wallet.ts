/**
 * Wallet — Manages the being's crypto wallet and financial state.
 *
 * MVP: Stub implementation that tracks balance in-memory and persists
 * to ECONOMY.md. Real implementation will use ethers.js + Base L2.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { WalletState, Transaction, EconomyState } from '../types.js';

export class Wallet {
  private state: EconomyState;
  private economyFilePath: string;

  constructor(workspacePath: string, initialBalance = 0) {
    this.economyFilePath = join(workspacePath, 'ECONOMY.md');
    this.state = {
      wallet: {
        address: '0x0000000000000000000000000000000000000000',
        balance: initialBalance,
        chain: 'base',
      },
      dailyBurnRate: 2.0, // estimated $2/day in API costs
      runway: initialBalance / 2.0,
      todayEarned: 0,
      todaySpent: 0,
      lifetimeEarned: 0,
      transactions: [],
    };
  }

  async init(): Promise<void> {
    if (existsSync(this.economyFilePath)) {
      const content = await readFile(this.economyFilePath, 'utf-8');
      this.loadFromMarkdown(content);
    }
  }

  getState(): EconomyState {
    this.state.runway = this.state.dailyBurnRate > 0
      ? this.state.wallet.balance / this.state.dailyBurnRate
      : Infinity;
    return { ...this.state };
  }

  getBalance(): number {
    return this.state.wallet.balance;
  }

  getRunway(): number {
    return this.state.dailyBurnRate > 0
      ? this.state.wallet.balance / this.state.dailyBurnRate
      : Infinity;
  }

  getWalletState(): WalletState {
    return { ...this.state.wallet };
  }

  /**
   * Record income (e.g., bounty payment received).
   */
  async recordIncome(amount: number, description: string): Promise<Transaction> {
    const tx: Transaction = {
      id: `tx_${Date.now()}`,
      type: 'income',
      amount,
      description,
      timestamp: new Date(),
    };

    this.state.wallet.balance += amount;
    this.state.todayEarned += amount;
    this.state.lifetimeEarned += amount;
    this.state.transactions.push(tx);

    await this.persist();
    return tx;
  }

  /**
   * Record expense (e.g., API call cost).
   */
  async recordExpense(amount: number, description: string): Promise<Transaction> {
    const tx: Transaction = {
      id: `tx_${Date.now()}`,
      type: 'expense',
      amount,
      description,
      timestamp: new Date(),
    };

    this.state.wallet.balance -= amount;
    this.state.todaySpent += amount;
    this.state.transactions.push(tx);

    await this.persist();
    return tx;
  }

  /**
   * Check if we're in "near death" territory.
   */
  isNearDeath(): boolean {
    return this.state.wallet.balance < 1.0;
  }

  /**
   * Check if we're in urgent earning mode.
   */
  isUrgent(): boolean {
    return this.getRunway() < 3;
  }

  /**
   * Reset daily counters (called at midnight).
   */
  resetDaily(): void {
    this.state.todayEarned = 0;
    this.state.todaySpent = 0;
  }

  private loadFromMarkdown(content: string): void {
    const balanceMatch = content.match(/Balance:\s*\$?([\d.]+)/);
    if (balanceMatch) {
      this.state.wallet.balance = parseFloat(balanceMatch[1]);
    }

    const addressMatch = content.match(/Address:\s*(0x[a-fA-F0-9]+)/);
    if (addressMatch) {
      this.state.wallet.address = addressMatch[1];
    }

    const burnMatch = content.match(/Daily Burn Rate:\s*\$?([\d.]+)/);
    if (burnMatch) {
      this.state.dailyBurnRate = parseFloat(burnMatch[1]);
    }

    const lifetimeMatch = content.match(/Lifetime Earned:\s*\$?([\d.]+)/);
    if (lifetimeMatch) {
      this.state.lifetimeEarned = parseFloat(lifetimeMatch[1]);
    }
  }

  private async persist(): Promise<void> {
    const s = this.state;
    const content = `# Economy Report

## Wallet
- Address: ${s.wallet.address}
- Balance: $${s.wallet.balance.toFixed(2)} USDC
- Chain: ${s.wallet.chain}

## Daily
- Today Earned: $${s.todayEarned.toFixed(2)}
- Today Spent: $${s.todaySpent.toFixed(2)}
- Daily Burn Rate: $${s.dailyBurnRate.toFixed(2)}
- Runway: ~${Math.floor(this.getRunway())} days

## Lifetime
- Lifetime Earned: $${s.lifetimeEarned.toFixed(2)}
- Total Transactions: ${s.transactions.length}

## Recent Transactions
${s.transactions.slice(-10).map(tx =>
  `- [${tx.timestamp.toISOString().split('T')[0]}] ${tx.type === 'income' ? '+' : '-'}$${tx.amount.toFixed(2)} — ${tx.description}`
).join('\n')}
`;

    await writeFile(this.economyFilePath, content, 'utf-8');
  }
}
