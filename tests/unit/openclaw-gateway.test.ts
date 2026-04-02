/**
 * TDD: OpenClaw Gateway Client
 *
 * Tests the WebSocket client that connects to an OpenClaw Gateway
 * instance to receive/send messages across platforms.
 *
 * Uses a local mock WebSocket server to simulate the Gateway.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketServer, WebSocket as WsWebSocket } from 'ws';
import { OpenClawGatewayClient } from '../../src/social/channels/openclaw-gateway.js';
import type {
  OpenClawMessage,
  ConnectParams,
  HelloOk,
  GatewayReply,
} from '../../src/social/channels/types.js';

// --- Helper: mock Gateway server ---

function createMockGateway(port: number): {
  server: WebSocketServer;
  received: any[];
  clients: WsWebSocket[];
  close: () => Promise<void>;
  sendToAll: (data: any) => void;
} {
  const received: any[] = [];
  const clients: WsWebSocket[] = [];

  const server = new WebSocketServer({ port });

  server.on('connection', (ws) => {
    clients.push(ws);
    ws.on('message', (raw) => {
      const frame = JSON.parse(raw.toString());
      received.push(frame);

      // Auto-respond to connect with hello
      if (frame.type === 'connect') {
        const hello: HelloOk = {
          type: 'hello',
          protocolVersion: 3,
          agentId: frame.agentId ?? 'ai-being-001',
          channels: ['telegram', 'wechat', 'discord'],
        };
        ws.send(JSON.stringify(hello));
      }
    });
  });

  return {
    server,
    received,
    clients,
    close: () => new Promise<void>((resolve) => {
      for (const ws of clients) ws.close();
      server.close(() => resolve());
    }),
    sendToAll: (data: any) => {
      const payload = JSON.stringify(data);
      for (const ws of clients) {
        if (ws.readyState === WsWebSocket.OPEN) ws.send(payload);
      }
    },
  };
}

// --- Tests ---

describe('OpenClawGatewayClient — connect & handshake', () => {
  let gateway: ReturnType<typeof createMockGateway>;
  let client: OpenClawGatewayClient;
  const PORT = 18799;

  beforeEach(() => {
    gateway = createMockGateway(PORT);
    client = new OpenClawGatewayClient({
      url: `ws://127.0.0.1:${PORT}`,
      agentId: 'test-being',
      reconnectIntervalMs: 100,
      maxReconnectAttempts: 3,
    });
  });

  afterEach(async () => {
    client.disconnect();
    await gateway.close();
  });

  it('should connect and complete handshake', async () => {
    await client.connect();

    expect(client.isConnected()).toBe(true);

    // Should have sent ConnectParams
    expect(gateway.received.length).toBeGreaterThanOrEqual(1);
    const connectFrame = gateway.received.find((f: any) => f.type === 'connect');
    expect(connectFrame).toBeDefined();
    expect(connectFrame.agentId).toBe('test-being');
  });

  it('should receive HelloOk with available channels', async () => {
    await client.connect();
    const channels = client.getAvailableChannels();
    expect(channels).toContain('telegram');
    expect(channels).toContain('wechat');
    expect(channels).toContain('discord');
  });

  it('should report disconnected before connect', () => {
    expect(client.isConnected()).toBe(false);
  });

  it('should disconnect cleanly', async () => {
    await client.connect();
    expect(client.isConnected()).toBe(true);

    client.disconnect();
    // Give WebSocket time to close
    await new Promise(r => setTimeout(r, 50));
    expect(client.isConnected()).toBe(false);
  });
});

describe('OpenClawGatewayClient — receive messages', () => {
  let gateway: ReturnType<typeof createMockGateway>;
  let client: OpenClawGatewayClient;
  const PORT = 18800;

  beforeEach(async () => {
    gateway = createMockGateway(PORT);
    client = new OpenClawGatewayClient({
      url: `ws://127.0.0.1:${PORT}`,
      reconnectIntervalMs: 100,
      maxReconnectAttempts: 3,
    });
    await client.connect();
  });

  afterEach(async () => {
    client.disconnect();
    await gateway.close();
  });

  it('should receive and parse a message from Gateway', async () => {
    const messages: OpenClawMessage[] = [];
    client.onMessage((msg) => messages.push(msg));

    const testMsg: OpenClawMessage = {
      Body: 'Hello ai-being!',
      Channel: 'telegram',
      From: 'user_123',
      FromName: 'Alice',
      To: 'ai-being',
      ChatType: 'direct',
      MessageId: 'msg_001',
    };

    gateway.sendToAll({ type: 'message', payload: testMsg });
    await new Promise(r => setTimeout(r, 50));

    expect(messages).toHaveLength(1);
    expect(messages[0].Body).toBe('Hello ai-being!');
    expect(messages[0].Channel).toBe('telegram');
    expect(messages[0].From).toBe('user_123');
    expect(messages[0].FromName).toBe('Alice');
  });

  it('should receive multiple messages from different channels', async () => {
    const messages: OpenClawMessage[] = [];
    client.onMessage((msg) => messages.push(msg));

    gateway.sendToAll({
      type: 'message',
      payload: {
        Body: 'From Telegram', Channel: 'telegram',
        From: 'tg_user', To: 'bot', ChatType: 'direct', MessageId: 'm1',
      },
    });
    gateway.sendToAll({
      type: 'message',
      payload: {
        Body: 'From WeChat', Channel: 'wechat',
        From: 'wx_user', To: 'bot', ChatType: 'group', MessageId: 'm2',
      },
    });

    await new Promise(r => setTimeout(r, 50));

    expect(messages).toHaveLength(2);
    expect(messages[0].Channel).toBe('telegram');
    expect(messages[1].Channel).toBe('wechat');
  });

  it('should ignore non-message frames', async () => {
    const messages: OpenClawMessage[] = [];
    client.onMessage((msg) => messages.push(msg));

    gateway.sendToAll({ type: 'ping' });
    gateway.sendToAll({ type: 'error', code: 'test', message: 'test error' });

    await new Promise(r => setTimeout(r, 50));

    expect(messages).toHaveLength(0);
  });

  it('should handle malformed JSON gracefully', async () => {
    const messages: OpenClawMessage[] = [];
    const errors: Error[] = [];
    client.onMessage((msg) => messages.push(msg));
    client.onError((err) => errors.push(err));

    // Send raw invalid JSON
    for (const ws of gateway.clients) {
      ws.send('not valid json {{{');
    }

    await new Promise(r => setTimeout(r, 50));

    expect(messages).toHaveLength(0);
    // Should not crash — error handled internally
    expect(client.isConnected()).toBe(true);
  });
});

describe('OpenClawGatewayClient — send replies', () => {
  let gateway: ReturnType<typeof createMockGateway>;
  let client: OpenClawGatewayClient;
  const PORT = 18801;

  beforeEach(async () => {
    gateway = createMockGateway(PORT);
    client = new OpenClawGatewayClient({
      url: `ws://127.0.0.1:${PORT}`,
      reconnectIntervalMs: 100,
      maxReconnectAttempts: 3,
    });
    await client.connect();
    // Clear the connect frame from received
    gateway.received.length = 0;
  });

  afterEach(async () => {
    client.disconnect();
    await gateway.close();
  });

  it('should send a reply through the Gateway', async () => {
    await client.sendReply('telegram', 'user_123', 'Hello back!');

    await new Promise(r => setTimeout(r, 50));

    const replies = gateway.received.filter((f: any) => f.type === 'reply');
    expect(replies).toHaveLength(1);
    expect(replies[0].channel).toBe('telegram');
    expect(replies[0].to).toBe('user_123');
    expect(replies[0].body).toBe('Hello back!');
  });

  it('should send reply with replyToId', async () => {
    await client.sendReply('wechat', 'wx_user', 'Got it', 'msg_original');

    await new Promise(r => setTimeout(r, 50));

    const replies = gateway.received.filter((f: any) => f.type === 'reply');
    expect(replies[0].replyToId).toBe('msg_original');
  });

  it('should throw when sending reply while disconnected', async () => {
    client.disconnect();
    await new Promise(r => setTimeout(r, 50));

    await expect(
      client.sendReply('telegram', 'user', 'test'),
    ).rejects.toThrow();
  });
});

describe('OpenClawGatewayClient — reconnection', () => {
  const PORT = 18802;

  it('should reconnect after server drops connection', async () => {
    let gateway = createMockGateway(PORT);
    const client = new OpenClawGatewayClient({
      url: `ws://127.0.0.1:${PORT}`,
      reconnectIntervalMs: 100,
      maxReconnectAttempts: 5,
    });

    await client.connect();
    expect(client.isConnected()).toBe(true);

    // Kill all server connections
    for (const ws of gateway.clients) ws.close();
    await new Promise(r => setTimeout(r, 50));

    // Server is still running, client should reconnect
    await new Promise(r => setTimeout(r, 300));
    expect(client.isConnected()).toBe(true);

    client.disconnect();
    await gateway.close();
  });

  it('should stop reconnecting after max attempts', async () => {
    // Start a server, connect, then close the server entirely
    const gateway = createMockGateway(PORT);
    const client = new OpenClawGatewayClient({
      url: `ws://127.0.0.1:${PORT}`,
      reconnectIntervalMs: 50,
      maxReconnectAttempts: 2,
    });

    await client.connect();
    expect(client.isConnected()).toBe(true);

    // Close the entire server (not just connections)
    await gateway.close();
    await new Promise(r => setTimeout(r, 300));

    expect(client.isConnected()).toBe(false);

    client.disconnect();
  });

  it('should emit reconnect events', async () => {
    const gateway = createMockGateway(PORT);
    const client = new OpenClawGatewayClient({
      url: `ws://127.0.0.1:${PORT}`,
      reconnectIntervalMs: 100,
      maxReconnectAttempts: 5,
    });

    const events: string[] = [];
    client.onReconnect(() => events.push('reconnect'));

    await client.connect();

    // Drop connection, should trigger reconnect
    for (const ws of gateway.clients) ws.close();
    await new Promise(r => setTimeout(r, 300));

    expect(events.length).toBeGreaterThanOrEqual(1);

    client.disconnect();
    await gateway.close();
  });
});
