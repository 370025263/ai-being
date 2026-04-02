/**
 * TDD: Channel Manager
 *
 * Bridges OpenClaw Gateway messages to the Inbox system and
 * auto-manages social relations.
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
          type: 'hello', protocolVersion: 3,
          agentId: 'test', channels: ['telegram', 'wechat'],
        };
        ws.send(JSON.stringify(hello));
      }
    });
  });

  return {
    server, received, clients,
    close: () => new Promise<void>(r => { for (const c of clients) c.close(); server.close(() => r()); }),
    sendToAll: (data: any) => {
      const s = JSON.stringify(data);
      for (const c of clients) if (c.readyState === WsWebSocket.OPEN) c.send(s);
    },
  };
}

describe('ChannelManager — message routing to Inbox', () => {
  let gateway: ReturnType<typeof createMockGateway>;
  let tempDir: string;
  let inbox: Inbox;
  let relations: RelationsManager;
  let manager: ChannelManager;
  const PORT = 18810;

  beforeEach(async () => {
    gateway = createMockGateway(PORT);
    tempDir = await mkdtemp(join(tmpdir(), 'ai-being-cm-'));
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

  it('should route incoming Gateway message to Inbox', async () => {
    gateway.sendToAll({
      type: 'message',
      payload: {
        Body: 'Hey there!', Channel: 'telegram',
        From: 'alice', FromName: 'Alice', To: 'bot',
        ChatType: 'direct', MessageId: 'msg_1',
      } satisfies OpenClawMessage,
    });

    await new Promise(r => setTimeout(r, 100));

    expect(inbox.getUnreadCount()).toBe(1);
    const summary = inbox.generateSummary();
    expect(summary.entries[0].source).toBe('telegram');
    expect(summary.entries[0].sender).toBe('alice');
    expect(summary.entries[0].preview).toContain('Hey there');
  });

  it('should route messages from multiple channels', async () => {
    gateway.sendToAll({
      type: 'message',
      payload: {
        Body: 'From TG', Channel: 'telegram',
        From: 'tg_user', To: 'bot', ChatType: 'direct', MessageId: 'm1',
      },
    });
    gateway.sendToAll({
      type: 'message',
      payload: {
        Body: 'From WX', Channel: 'wechat',
        From: 'wx_user', To: 'bot', ChatType: 'group', MessageId: 'm2',
      },
    });

    await new Promise(r => setTimeout(r, 100));

    expect(inbox.getUnreadCount()).toBe(2);
    const summary = inbox.generateSummary();
    expect(summary.platformStats['telegram'].unread).toBe(1);
    expect(summary.platformStats['wechat'].unread).toBe(1);
  });
});

describe('ChannelManager — auto-create relations', () => {
  let gateway: ReturnType<typeof createMockGateway>;
  let tempDir: string;
  let inbox: Inbox;
  let relations: RelationsManager;
  let manager: ChannelManager;
  const PORT = 18811;

  beforeEach(async () => {
    gateway = createMockGateway(PORT);
    tempDir = await mkdtemp(join(tmpdir(), 'ai-being-cm-'));
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

  it('should auto-create a relation file for new sender', async () => {
    gateway.sendToAll({
      type: 'message',
      payload: {
        Body: 'Hi!', Channel: 'telegram',
        From: 'new_person', FromName: 'Bob', To: 'bot',
        ChatType: 'direct', MessageId: 'msg_1',
      },
    });

    await new Promise(r => setTimeout(r, 100));

    const people = await relations.listPeople();
    expect(people.length).toBeGreaterThanOrEqual(1);
    expect(people.some(p => p.includes('new_person'))).toBe(true);
  });

  it('should increment interaction count on repeated messages', async () => {
    const msg = {
      type: 'message',
      payload: {
        Body: 'msg', Channel: 'telegram',
        From: 'repeat_user', To: 'bot',
        ChatType: 'direct' as const, MessageId: 'x',
      },
    };

    gateway.sendToAll(msg);
    await new Promise(r => setTimeout(r, 100));
    gateway.sendToAll({ ...msg, payload: { ...msg.payload, MessageId: 'y', Body: 'again' } });
    await new Promise(r => setTimeout(r, 100));

    const relation = await relations.getOrCreatePerson('repeat_user', 'telegram');
    expect(relation.interactionCount).toBeGreaterThanOrEqual(2);
  });

  it('should auto-create platform cognition file', async () => {
    gateway.sendToAll({
      type: 'message',
      payload: {
        Body: 'Test', Channel: 'discord',
        From: 'disc_user', To: 'bot',
        ChatType: 'channel', MessageId: 'msg_d1',
      },
    });

    await new Promise(r => setTimeout(r, 100));

    const platforms = await relations.listPlatforms();
    expect(platforms.some(p => p.includes('discord'))).toBe(true);
  });
});

describe('ChannelManager — send replies', () => {
  let gateway: ReturnType<typeof createMockGateway>;
  let tempDir: string;
  let inbox: Inbox;
  let relations: RelationsManager;
  let manager: ChannelManager;
  const PORT = 18812;

  beforeEach(async () => {
    gateway = createMockGateway(PORT);
    tempDir = await mkdtemp(join(tmpdir(), 'ai-being-cm-'));
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
    gateway.received.length = 0;
  });

  afterEach(async () => {
    manager.disconnect();
    await gateway.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should send reply through Gateway', async () => {
    await manager.reply('telegram', 'user_123', 'Hello!');
    await new Promise(r => setTimeout(r, 50));

    const replies = gateway.received.filter((f: any) => f.type === 'reply');
    expect(replies).toHaveLength(1);
    expect(replies[0].channel).toBe('telegram');
    expect(replies[0].to).toBe('user_123');
    expect(replies[0].body).toBe('Hello!');
  });

  it('should report connection status', () => {
    expect(manager.isConnected()).toBe(true);
    manager.disconnect();
    expect(manager.isConnected()).toBe(false);
  });

  it('should list available channels from Gateway', () => {
    const channels = manager.getAvailableChannels();
    expect(channels).toContain('telegram');
    expect(channels).toContain('wechat');
  });
});
