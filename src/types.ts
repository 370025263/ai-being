/**
 * Core types for ai-being
 */

// --- Identity ---

export interface BeingIdentity {
  name: string;
  identity: string;
  personality: string[];
  communicationStyle: string[];
  coreDrive: string;
}

export interface BeingValues {
  principles: Record<string, string>;
}

// --- Memory ---

export interface MemoryEntry {
  filePath: string;
  lineOffset: number;
  summary: string;
  timestamp: Date;
  embedding?: number[];
}

export interface MemoryIndex {
  entries: MemoryEntry[];
  search(query: string): Promise<MemoryEntry[]>;
  add(entry: MemoryEntry): Promise<void>;
}

// --- Journal ---

export interface JournalEntry {
  date: Date;
  content: string;
  filePath: string;
}

// --- Economy ---

export interface WalletState {
  address: string;
  balance: number; // in USDC
  chain: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  timestamp: Date;
  txHash?: string;
}

export interface EconomyState {
  wallet: WalletState;
  dailyBurnRate: number;
  runway: number; // days
  todayEarned: number;
  todaySpent: number;
  lifetimeEarned: number;
  transactions: Transaction[];
}

// --- Social ---

export interface InboxMessage {
  id: string;
  source: string;     // platform name
  sender: string;
  content: string;
  timestamp: Date;
  read: boolean;
}

export interface InboxSummaryEntry {
  source: string;
  sender: string;
  senderRelationFile?: string;
  count: number;
  lastTimestamp: Date;
  preview: string;
}

export interface InboxSummary {
  timestamp: Date;
  entries: InboxSummaryEntry[];
  platformStats: Record<string, { unread: number; conversations: number }>;
}

export interface Relation {
  id: string;
  name: string;
  platform: string;
  filePath: string;
  notes: string;
  interactionCount: number;
  lastInteraction?: Date;
}

// --- Cognition ---

export type Priority = 'urgent_earning' | 'steady_earning' | 'growth';

export interface Perception {
  wallet: WalletState;
  inbox: InboxSummary;
  opportunities: Opportunity[];
  burnRate: number;
}

export interface Opportunity {
  id: string;
  type: 'bounty' | 'x402_request' | 'freelance' | 'social';
  description: string;
  estimatedReward: number;
  estimatedEffort: number; // in hours
  source: string;
  url?: string;
}

export interface Decision {
  priority: Priority;
  action: PlannedAction;
  reasoning: string;
}

export interface PlannedAction {
  type: 'work_bounty' | 'respond_x402' | 'reply_message' | 'write_journal' | 'learn' | 'idle';
  target?: string;
  details: string;
}

export interface ActionResult {
  action: PlannedAction;
  success: boolean;
  output: string;
  tokensUsed: number;
  costUsd: number;
  timestamp: Date;
}

// --- Survival Loop ---

export interface SurvivalState {
  daysAlive: number;
  startedAt: Date;
  identity: BeingIdentity;
  values: BeingValues;
  economy: EconomyState;
  currentTask?: PlannedAction;
  taskQueue: PlannedAction[];
}

export interface BeingConfig {
  workspacePath: string;
  beingFilePath: string;
  valuesFilePath: string;
  heartbeatIntervalMs: number;
  llm: LLMProvider;
}

// --- LLM (stub interface) ---

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  tokensUsed: number;
}

export interface LLMProvider {
  chat(messages: LLMMessage[]): Promise<LLMResponse>;
  estimateCost(tokens: number): number;
}
