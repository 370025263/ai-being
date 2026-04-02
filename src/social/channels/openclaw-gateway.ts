/**
 * OpenClaw Gateway WebSocket Client
 *
 * Connects to an OpenClaw Gateway instance to receive messages
 * from all connected channels (WeChat, Telegram, Discord, etc.)
 * and send replies back through them.
 *
 * Protocol:
 *   1. Client connects via WebSocket
 *   2. Client sends ConnectParams (agentId, capabilities)
 *   3. Server responds with HelloOk (protocolVersion, channels)
 *   4. Server pushes { type: 'message', payload: OpenClawMessage }
 *   5. Client sends { type: 'reply', channel, to, body } to respond
 */
import WebSocket from 'ws';
import type {
  OpenClawMessage,
  OpenClawGatewayConfig,
  ConnectParams,
  HelloOk,
  GatewayReply,
  GatewayFrame,
} from './types.js';

export class OpenClawGatewayClient {
  private config: OpenClawGatewayConfig;
  private ws: WebSocket | null = null;
  private connected = false;
  private availableChannels: string[] = [];
  private reconnectAttempts = 0;
  private reconnecting = false;
  private intentionalDisconnect = false;

  // Event handlers
  private messageHandlers: Array<(msg: OpenClawMessage) => void> = [];
  private errorHandlers: Array<(err: Error) => void> = [];
  private reconnectHandlers: Array<() => void> = [];

  constructor(config: OpenClawGatewayConfig) {
    this.config = config;
  }

  /**
   * Connect to the OpenClaw Gateway and perform handshake.
   * Resolves once HelloOk is received.
   */
  async connect(): Promise<void> {
    this.intentionalDisconnect = false;
    this.reconnectAttempts = 0;
    return this.doConnect();
  }

  private doConnect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url);
      } catch (err) {
        reject(err);
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Gateway connection timeout'));
      }, 10000);

      this.ws.on('open', () => {
        // Send handshake
        const connectParams: ConnectParams = {
          type: 'connect',
          agentId: this.config.agentId,
          capabilities: ['message', 'reply'],
        };
        this.ws!.send(JSON.stringify(connectParams));
      });

      this.ws.on('message', (raw) => {
        let frame: GatewayFrame;
        try {
          frame = JSON.parse(raw.toString());
        } catch {
          for (const handler of this.errorHandlers) {
            handler(new Error(`Invalid JSON from Gateway: ${raw.toString().slice(0, 100)}`));
          }
          return;
        }

        // Handle HelloOk (handshake response)
        if (frame.type === 'hello') {
          const hello = frame as HelloOk;
          this.connected = true;
          this.availableChannels = hello.channels;
          this.reconnectAttempts = 0;
          clearTimeout(timeout);
          resolve();
          return;
        }

        // Handle incoming messages
        if (frame.type === 'message' && 'payload' in frame) {
          const msg = (frame as { type: 'message'; payload: OpenClawMessage }).payload;
          for (const handler of this.messageHandlers) {
            handler(msg);
          }
          return;
        }

        // Handle errors from server
        if (frame.type === 'error' && 'message' in frame) {
          for (const handler of this.errorHandlers) {
            handler(new Error(`Gateway error: ${(frame as any).message}`));
          }
          return;
        }

        // Ping/pong and other frames: ignore silently
      });

      this.ws.on('close', () => {
        this.connected = false;
        if (!this.intentionalDisconnect) {
          this.attemptReconnect();
        }
      });

      this.ws.on('error', (err) => {
        this.connected = false;
        for (const handler of this.errorHandlers) {
          handler(err);
        }
        // If we haven't resolved yet (during initial connect), reject
        clearTimeout(timeout);
        // Don't reject on reconnect-phase errors
        if (!this.reconnecting) {
          // Only reject if this is the initial connect attempt
        }
      });
    });
  }

  /**
   * Disconnect from the Gateway.
   */
  disconnect(): void {
    this.intentionalDisconnect = true;
    this.connected = false;
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  /**
   * Send a reply back through the Gateway to a specific channel/user.
   */
  async sendReply(channel: string, to: string, body: string, replyToId?: string): Promise<void> {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to Gateway');
    }

    const reply: GatewayReply = {
      type: 'reply',
      channel,
      to,
      body,
      replyToId,
    };

    this.ws.send(JSON.stringify(reply));
  }

  /**
   * Register a handler for incoming messages.
   */
  onMessage(handler: (msg: OpenClawMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Register a handler for errors.
   */
  onError(handler: (err: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Register a handler for reconnection events.
   */
  onReconnect(handler: () => void): void {
    this.reconnectHandlers.push(handler);
  }

  isConnected(): boolean {
    return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getAvailableChannels(): string[] {
    return [...this.availableChannels];
  }

  private attemptReconnect(): void {
    if (this.intentionalDisconnect) return;
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) return;

    this.reconnectAttempts++;
    this.reconnecting = true;

    setTimeout(async () => {
      if (this.intentionalDisconnect) return;

      try {
        await this.doConnect();
        for (const handler of this.reconnectHandlers) {
          handler();
        }
      } catch {
        // doConnect failed, will retry via the close handler
      } finally {
        this.reconnecting = false;
      }
    }, this.config.reconnectIntervalMs);
  }
}
