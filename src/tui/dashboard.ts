/**
 * TUI Dashboard — The being's "body" in the terminal.
 *
 * Renders a live dashboard showing the being's state:
 * wallet, current task, inbox, thoughts, lifetime stats.
 *
 * MVP: Simple text rendering. Will use ink (React for CLI) later.
 */
import type { SurvivalState, ActionResult } from '../types.js';

export class Dashboard {
  private width: number;

  constructor(width = 60) {
    this.width = width;
  }

  /**
   * Render the full dashboard as a string.
   */
  render(state: SurvivalState, lastResult?: ActionResult): string {
    const lines: string[] = [];
    const w = this.width;
    const border = '═'.repeat(w - 2);

    lines.push(`╔${border}╗`);
    lines.push(this.centerLine(`ai-being v0.1.0          Day ${Math.floor(state.daysAlive)} alive`, w));
    lines.push(`╠${border}╣`);
    lines.push(this.padLine('', w));

    // Wallet
    const addr = state.economy.wallet.address;
    const shortAddr = `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    lines.push(this.padLine(`  Wallet: ${shortAddr}`, w));
    lines.push(this.padLine(`  Balance: $${state.economy.wallet.balance.toFixed(2)} USDC    Runway: ~${Math.floor(state.economy.runway)} days`, w));
    lines.push(this.padLine(`  Today: +$${state.economy.todayEarned.toFixed(2)} earned  -$${state.economy.todaySpent.toFixed(2)} spent`, w));
    lines.push(this.padLine('', w));

    // Current Task
    if (state.currentTask) {
      lines.push(this.padLine(`  Current Task:`, w));
      lines.push(this.padLine(`  [${state.currentTask.type}] ${state.currentTask.details.slice(0, w - 8)}`, w));
    } else {
      lines.push(this.padLine(`  Current Task: idle`, w));
    }
    lines.push(this.padLine('', w));

    // Queue
    lines.push(this.padLine(`  Queue: ${state.taskQueue.length} tasks`, w));
    for (const task of state.taskQueue.slice(0, 3)) {
      lines.push(this.padLine(`  - [${task.type}] ${task.details.slice(0, w - 12)}`, w));
    }
    lines.push(this.padLine('', w));

    // Last action
    if (lastResult) {
      lines.push(this.padLine(`  Last Action:`, w));
      lines.push(this.padLine(`  ${lastResult.output.slice(0, w - 6)}`, w));
      lines.push(this.padLine(`  Cost: $${lastResult.costUsd.toFixed(4)} (${lastResult.tokensUsed} tokens)`, w));
    }
    lines.push(this.padLine('', w));

    // Lifetime stats
    lines.push(this.padLine(`  Lifetime Earned: $${state.economy.lifetimeEarned.toFixed(2)}`, w));
    lines.push(this.padLine('', w));

    lines.push(`╚${border}╝`);

    return lines.join('\n');
  }

  /**
   * Render a compact status line (for logging).
   */
  renderStatusLine(state: SurvivalState): string {
    const runway = Math.floor(state.economy.runway);
    const balance = state.economy.wallet.balance.toFixed(2);
    const task = state.currentTask?.type ?? 'idle';
    return `[Day ${Math.floor(state.daysAlive)}] $${balance} (~${runway}d) | ${task}`;
  }

  private padLine(content: string, width: number): string {
    const inner = content.padEnd(width - 4);
    return `║ ${inner} ║`;
  }

  private centerLine(content: string, width: number): string {
    const padTotal = width - 4 - content.length;
    const padLeft = Math.floor(padTotal / 2);
    const padRight = padTotal - padLeft;
    return `║ ${' '.repeat(padLeft)}${content}${' '.repeat(padRight)} ║`;
  }
}
