/**
 * Channel Manager — Bridges OpenClaw Gateway to the Inbox and Relations systems.
 *
 * Responsibilities:
 * - Connects to OpenClaw Gateway via WebSocket
 * - Routes incoming messages to Inbox (as metadata, not raw content to LLM)
 * - Auto-creates/updates relation files for new senders
 * - Provides reply interface for the survival loop's act() phase
 */
import { OpenClawGatewayClient } from './openclaw-gateway.js';
import type { OpenClawMessage, OpenClawGatewayConfig } from './types.js';
import type { Inbox } from '../inbox.js';
import type { RelationsManager } from '../relations.js';

export class ChannelManager {
  private client: OpenClawGatewayClient;
  private inbox: Inbox;
  private relations: RelationsManager;

  constructor(inbox: Inbox, relations: RelationsManager, config: OpenClawGatewayConfig) {
    this.inbox = inbox;
    this.relations = relations;
    this.client = new OpenClawGatewayClient(config);

    // Wire up message routing
    this.client.onMessage((msg) => {
      this.handleIncomingMessage(msg);
    });
  }

  /**
   * Connect to the OpenClaw Gateway.
   */
  async connect(): Promise<void> {
    await this.client.connect();
  }

  /**
   * Disconnect from the Gateway.
   */
  disconnect(): void {
    this.client.disconnect();
  }

  /**
   * Send a reply through the Gateway to a specific channel/user.
   */
  async reply(channel: string, to: string, body: string, replyToId?: string): Promise<void> {
    await this.client.sendReply(channel, to, body, replyToId);
  }

  isConnected(): boolean {
    return this.client.isConnected();
  }

  getAvailableChannels(): string[] {
    return this.client.getAvailableChannels();
  }

  /**
   * Handle an incoming message from the Gateway:
   * 1. Store in Inbox (for metadata summary)
   * 2. Auto-create/update relation for sender
   * 3. Auto-create platform cognition file
   */
  private async handleIncomingMessage(msg: OpenClawMessage): Promise<void> {
    // 1. Route to inbox
    await this.inbox.receive({
      source: msg.Channel,
      sender: msg.From,
      content: msg.Body,
      timestamp: msg.Timestamp ? new Date(msg.Timestamp) : new Date(),
    });

    // 2. Auto-create/update relation for sender (fire-and-forget)
    this.updateRelation(msg).catch(() => {
      // Silently ignore relation update failures
    });

    // 3. Auto-create platform cognition file (fire-and-forget)
    this.relations.getOrCreatePlatform(msg.Channel).catch(() => {});
  }

  private async updateRelation(msg: OpenClawMessage): Promise<void> {
    const relation = await this.relations.getOrCreatePerson(msg.From, msg.Channel);
    await this.relations.recordInteraction(relation.filePath);
  }
}
