/**
 * Integration test: Social Pipeline (Gateway → ChannelManager → Inbox → Relations)
 *
 * Verifies the full social message flow:
 *   OpenClaw Gateway message arrives
 *     → ChannelManager routes to Inbox
 *     → Relations auto-created for sender
 *     → Reply flows back through Gateway
 *
 * Uses a local mock WebSocket server to simulate the OpenClaw Gateway.
 * This test is stable — it tests cross-module contracts, not implementation details.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketServer, WebSocket as WsWebSocket } from 'ws';
import { ChannelManager } from '../../src/social/channels/channel-manager.js';
import { Inbox } from '../../src/social/inbox.js';
import { RelationsManager } from '../../src/social/relations.js';
import type { OpenClawMessage, HelloOk } from '../../src/social/channels/types.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// --- Mock Gateway server (simulates OpenClaw) ---

function createMockGateway(port: number) {
  const received: any[] = [];
  const clients: WsWebSocket[] = [];
  const server = new WebSocketServer({ port });

  server.on('connection', (ws) => {
    clients.push(ws);
    ws.on('message', (raw) => {
      const frame = JSON.parse(raw.toString());
      received.push(frame);
      if (frame.type === 'connect') {
        const hello: HelloOk = {
          type: 'hello',
          protocolVersion: 3,
          agentId: frame.agentId ?? 'ai-being',
          channels: ['telegram', 'wechat', 'discord'],
        };
        ws.send(JSON.stringify(hello));
      }
    });
  });

  return {
    server, received, clients,
    close: () => new Promise<void>((resolve) => {
      for (const c of clients) c.close();
      server.close(() => resolve());
    }),
    sendToAll: (data: any) => {
      const payload = JSON.stringify(data);
      for (const c of clients) {
        if (c.readyState === WsWebSocket.OPEN) c.send(payload);
      }
    },
  };
}

function makeMessage(overrides: Partial<OpenClawMessage> = {}): OpenClawMessage {
  return {
    Body: 'Hello from integration test',
    Channel: 'telegram',
    From: 'user_integration',
    FromName: 'Integration User',
    To: 'ai-being',
    ChatType: 'direct',
    MessageId: `msg_${Date.now()}`,
    ...overrides,
  };
}

// --- Tests ---

describe('Integration: Social Pipeline (Gateway → Inbox → Relations)', () => {
  let gateway: ReturnType<typeof createMockGateway>;
  let tempDir: string;
  let inbox: Inbox;
  let relations: RelationsManager;
  let manager: ChannelManager;
  const PORT = 18850;

  beforeEach(async () => {
    gateway = createMockGateway(PORT);
    tempDir = await mkdtemp(join(tmpdir(), 'ai-being-integ-social-'));
    inbox = new Inbox(tempDir);
    relations = new RelationsManager(tempDir);
    await inbox.init();
    await relations.init();

    manager = new ChannelManager(inbox, relations, {
      url: `ws://127.0.0.1:${PORT}`,
      reconnectIntervalMs: 100,
      maxReconnectAttempts: 2,
    });
    await manager.connect();
  });

  afterEach(async () => {
    manager.disconnect();
    await gateway.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('end-to-end: message arrives → inbox populated → relation created', async () => {
    // 1. Simulate a message from Telegram user via Gateway
    gateway.sendToAll({
      type: 'message',
      payload: makeMessage({
        Body: 'Can you help me with a code review?',
        Channel: 'telegram',
        From: 'alice_tg',
        FromName: 'Alice',
      }),
    });

    await new Promise((r) => setTimeout(r, 200));

    // 2. Verify inbox received the message
    expect(inbox.getUnreadCount()).toBe(1);
    const summary = inbox.generateSummary();
    expect(summary.entries).toHaveLength(1);
    expect(summary.entries[0].source).toBe('telegram');
    expect(summary.entries[0].sender).toBe('alice_tg');
    expect(summary.entries[0].preview).toContain('code review');

    // 3. Verify relation was auto-created
    const people = await relations.listPeople();
    expect(people.some((p) => p.includes('alice_tg'))).toBe(true);

    // 4. Verify platform cognition file created
    const platforms = await relations.listPlatforms();
    expect(platforms.some((p) => p.includes('telegram'))).toBe(true);
  });

  it('end-to-end: multi-channel messages → correct platform stats', async () => {
    // Simulate messages from 3 different channels
    gateway.sendToAll({
      type: 'message',
      payload: makeMessage({ Channel: 'telegram', From: 'tg_user', MessageId: 'm1' }),
    });
    gateway.sendToAll({
      type: 'message',
      payload: makeMessage({ Channel: 'wechat', From: 'wx_user', MessageId: 'm2' }),
    });
    gateway.sendToAll({
      type: 'message',
      payload: makeMessage({ Channel: 'discord', From: 'dc_user', MessageId: 'm3' }),
    });

    await new Promise((r) => setTimeout(r, 200));

    // Verify all 3 messages arrived
    expect(inbox.getUnreadCount()).toBe(3);

    // Verify per-platform stats
    const summary = inbox.generateSummary();
    expect(summary.platformStats['telegram'].unread).toBe(1);
    expect(summary.platformStats['wechat'].unread).toBe(1);
    expect(summary.platformStats['discord'].unread).toBe(1);

    // Verify relations for all 3 senders
    const people = await relations.listPeople();
    expect(people.length).toBeGreaterThanOrEqual(3);
  });

  it('end-to-end: reply flows back through Gateway', async () => {
    // Clear handshake frames
    gateway.received.length = 0;

    // Send reply via ChannelManager
    await manager.reply('telegram', 'alice_tg', 'Sure, I can review your code!');
    await new Promise((r) => setTimeout(r, 100));

    // Verify Gateway received the reply frame
    const replies = gateway.received.filter((f: any) => f.type === 'reply');
    expect(replies).toHaveLength(1);
    expect(replies[0]).toMatchObject({
      type: 'reply',
      channel: 'telegram',
      to: 'alice_tg',
      body: 'Sure, I can review your code!',
    });
  });

  it('end-to-end: repeated messages from same user → interaction count grows', async () => {
    for (let i = 0; i < 3; i++) {
      gateway.sendToAll({
        type: 'message',
        payload: makeMessage({
          From: 'repeat_user',
          MessageId: `msg_${i}`,
          Body: `Message ${i}`,
        }),
      });
      await new Promise((r) => setTimeout(r, 150));
    }

    const relation = await relations.getOrCreatePerson('repeat_user', 'telegram');
    expect(relation.interactionCount).toBeGreaterThanOrEqual(3);
  });
});
