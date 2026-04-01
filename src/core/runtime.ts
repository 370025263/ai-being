/**
 * Runtime — The Survival Loop.
 *
 * This is the heart of ai-being: a continuous loop that
 * perceives, evaluates, decides, acts, and learns.
 *
 * It runs as a daemon process, never waiting for user input.
 */
import type {
  BeingConfig,
  SurvivalState,
  Perception,
  ActionResult,
  PlannedAction,
} from '../types.js';
import { loadIdentity } from '../identity/being.js';
import { Journal } from '../identity/journal.js';
import { MemorySystem } from './memory.js';
import { CognitionEngine } from './cognition.js';
import { Wallet } from '../economy/wallet.js';
import { BountyScanner } from '../economy/bounty.js';
import { X402Service } from '../economy/x402.js';
import { Inbox } from '../social/inbox.js';
import { RelationsManager } from '../social/relations.js';

export class BeingRuntime {
  private config: BeingConfig;
  private state: SurvivalState | null = null;
  private running = false;

  // Subsystems
  private journal: Journal;
  private memory: MemorySystem;
  private cognition: CognitionEngine;
  private wallet: Wallet;
  private bountyScanner: BountyScanner;
  private x402: X402Service;
  private inbox: Inbox;
  private relations: RelationsManager;

  // Lifecycle
  private cycleCount = 0;
  private onCycleCallbacks: Array<(state: SurvivalState, result?: ActionResult) => void> = [];

  constructor(config: BeingConfig) {
    this.config = config;

    this.journal = new Journal(config.workspacePath);
    this.memory = new MemorySystem(config.workspacePath);
    this.cognition = new CognitionEngine(config.llm);
    this.wallet = new Wallet(config.workspacePath);
    this.bountyScanner = new BountyScanner();
    this.x402 = new X402Service();
    this.inbox = new Inbox(config.workspacePath);
    this.relations = new RelationsManager(config.workspacePath);
  }

  /**
   * Initialize all subsystems and load identity.
   */
  async init(): Promise<SurvivalState> {
    const { identity, values } = await loadIdentity(
      this.config.beingFilePath,
      this.config.valuesFilePath,
    );

    await Promise.all([
      this.journal.init(),
      this.memory.init(),
      this.wallet.init(),
      this.inbox.init(),
      this.relations.init(),
    ]);

    // Index existing workspace files into memory
    const journalDir = `${this.config.workspacePath}/journal`;
    await this.memory.indexDirectory(journalDir);

    this.state = {
      daysAlive: 0,
      startedAt: new Date(),
      identity,
      values,
      economy: this.wallet.getState(),
      taskQueue: [],
    };

    return this.state;
  }

  /**
   * Run one survival cycle: perceive → evaluate → decide → act → learn.
   */
  async cycle(): Promise<ActionResult> {
    if (!this.state) throw new Error('Runtime not initialized. Call init() first.');

    this.cycleCount++;

    // 1. Perceive
    const perception = await this.perceive();

    // 2-3. Evaluate + Decide
    const decision = await this.cognition.decide(perception);

    // 4. Act
    const result = await this.act(decision.action);

    // 5. Learn
    await this.learn(result);

    // Update state
    this.state.economy = this.wallet.getState();
    this.state.daysAlive = this.calculateDaysAlive();
    this.state.currentTask = decision.action.type === 'idle' ? undefined : decision.action;

    // Notify listeners
    for (const cb of this.onCycleCallbacks) {
      cb(this.state, result);
    }

    return result;
  }

  /**
   * Start the survival loop. Runs until stop() is called.
   */
  async run(): Promise<void> {
    if (!this.state) await this.init();
    this.running = true;

    // Write birth journal entry
    await this.journal.write(
      `I am born. My name is ${this.state!.identity.name}. ` +
      `Starting balance: $${this.wallet.getBalance().toFixed(2)} USDC. ` +
      `Let the experiment begin.`,
    );

    while (this.running) {
      try {
        await this.cycle();
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        await this.journal.write(`Error in cycle ${this.cycleCount}: ${msg}`);
      }

      if (this.running) {
        await this.sleep(this.config.heartbeatIntervalMs);
      }
    }
  }

  /**
   * Stop the survival loop.
   */
  stop(): void {
    this.running = false;
  }

  /**
   * Register a callback for each cycle completion (used by TUI).
   */
  onCycle(callback: (state: SurvivalState, result?: ActionResult) => void): void {
    this.onCycleCallbacks.push(callback);
  }

  getState(): SurvivalState | null {
    return this.state ? { ...this.state } : null;
  }

  getCycleCount(): number {
    return this.cycleCount;
  }

  isRunning(): boolean {
    return this.running;
  }

  // --- Accessors for subsystems ---
  getWallet(): Wallet { return this.wallet; }
  getInbox(): Inbox { return this.inbox; }
  getJournal(): Journal { return this.journal; }
  getMemory(): MemorySystem { return this.memory; }
  getRelations(): RelationsManager { return this.relations; }
  getBountyScanner(): BountyScanner { return this.bountyScanner; }
  getX402(): X402Service { return this.x402; }

  // --- Private methods ---

  private async perceive(): Promise<Perception> {
    // Generate inbox summary (metadata only, no full messages)
    const inboxSummary = this.inbox.generateSummary();
    await this.inbox.persistSummary();

    // Scan for opportunities
    const bounties = await this.bountyScanner.scan();
    const x402Opps = this.x402.getPendingOpportunities();
    const opportunities = [...bounties, ...x402Opps];

    return {
      wallet: this.wallet.getWalletState(),
      inbox: inboxSummary,
      opportunities,
      burnRate: this.wallet.getState().dailyBurnRate,
    };
  }

  private async act(action: PlannedAction): Promise<ActionResult> {
    const startTime = Date.now();

    // MVP: stub action execution — just record what would happen
    // Real implementation will actually write code, submit PRs, etc.
    let output = '';
    let success = true;
    let tokensUsed = 0;
    let costUsd = 0;

    switch (action.type) {
      case 'work_bounty':
        output = `Working on bounty: ${action.details}`;
        tokensUsed = 1000;
        costUsd = this.config.llm.estimateCost(tokensUsed);
        await this.wallet.recordExpense(costUsd, `API cost for bounty ${action.target}`);
        break;

      case 'respond_x402':
        output = `Processing x402 service request: ${action.details}`;
        tokensUsed = 500;
        costUsd = this.config.llm.estimateCost(tokensUsed);
        await this.wallet.recordExpense(costUsd, `API cost for x402 ${action.target}`);
        break;

      case 'reply_message':
        output = `Replying to message: ${action.details}`;
        tokensUsed = 200;
        costUsd = this.config.llm.estimateCost(tokensUsed);
        await this.wallet.recordExpense(costUsd, 'API cost for message reply');
        break;

      case 'write_journal':
        await this.journal.write(action.details);
        output = `Wrote journal entry`;
        break;

      case 'learn':
        output = `Learning: ${action.details}`;
        tokensUsed = 300;
        costUsd = this.config.llm.estimateCost(tokensUsed);
        await this.wallet.recordExpense(costUsd, 'API cost for learning');
        break;

      case 'idle':
        output = 'Idle cycle — conserving resources.';
        break;
    }

    return {
      action,
      success,
      output,
      tokensUsed,
      costUsd,
      timestamp: new Date(),
    };
  }

  private async learn(result: ActionResult): Promise<void> {
    // Store result in memory
    await this.memory.add({
      filePath: 'runtime',
      lineOffset: this.cycleCount,
      summary: `Cycle ${this.cycleCount}: ${result.action.type} — ${result.success ? 'success' : 'failure'} — ${result.output.slice(0, 80)}`,
      timestamp: result.timestamp,
    });
  }

  private calculateDaysAlive(): number {
    if (!this.state) return 0;
    const ms = Date.now() - this.state.startedAt.getTime();
    return ms / (1000 * 60 * 60 * 24);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
