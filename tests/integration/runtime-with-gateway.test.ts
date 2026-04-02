/**
 * Integration test: Full Runtime with Gateway
 *
 * Verifies the complete system working together:
 *   Runtime init with Gateway config
 *     → Gateway connects
 *     → Messages flow through to Inbox
 *     → Survival cycle perceives social messages
 *     → ChannelManager available for replies
 *
 * This is the highest-level integration test — tests the entire wiring.
 * Uses a local mock WebSocket server and StubLLMProvider.
 * This test is stable — it tests cross-module contracts, not implementation details.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketServer, WebSocket as WsWebSocket } from 'ws';
import { BeingRuntime } from '../../src/core/runtime.js';
import { StubLLMProvider } from '../../src/core/llm-stub.js';
import type { BeingConfig } from '../../src/types.js';
import type { HelloOk, OpenClawMessage } from '../../src/social/channels/types.js';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// --- Mock Gateway ---

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
          channels: ['telegram', 'wechat'],
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

// --- Test fixture helpers ---

async function createWorkspace(): Promise<{ tempDir: string; beingPath: string; valuesPath: string }> {
  const tempDir = await mkdtemp(join(tmpdir(), 'ai-being-integ-runtime-'));
  const beingPath = join(tempDir, 'BEING.md');
  const valuesPath = join(tempDir, 'VALUES.md');

  await writeFile(beingPath, `# BEING

## Name

integration-being

## Identity

I am an integration test being.

## Personality

- Curious

## Communication Style

- Direct

## Core Drive

Test everything thoroughly.
`);

  await writeFile(valuesPath, `# VALUES

## Quality

Ship quality code.

## Honesty

Be transparent.
`);

  return { tempDir, beingPath, valuesPath };
}

// --- Tests ---

describe('Integration: Runtime with Gateway', () => {
  let gateway: ReturnType<typeof createMockGateway>;
  let workspace: Awaited<ReturnType<typeof createWorkspace>>;
  let runtime: BeingRuntime;
  const PORT = 18860;

  beforeEach(async () => {
    gateway = createMockGateway(PORT);
    workspace = await createWorkspace();

    const llm = new StubLLMProvider({
      defaultResponse: JSON.stringify({
        action_type: 'reply_message',
        details: 'Responding to social message',
        reasoning: 'There are unread messages in the inbox',
      }),
    });

    const config: BeingConfig = {
      workspacePath: join(workspace.tempDir, 'workspace'),
      beingFilePath: workspace.beingPath,
      valuesFilePath: workspace.valuesPath,
      heartbeatIntervalMs: 100,
      llm,
      gateway: {
        url: `ws://127.0.0.1:${PORT}`,
        agentId: 'integration-being',
        reconnectIntervalMs: 100,
        maxReconnectAttempts: 2,
      },
    };

    runtime = new BeingRuntime(config);
  });

  afterEach(async () => {
    runtime.stop();
    await gateway.close();
    await rm(workspace.tempDir, { recursive: true, force: true });
  });

  it('should init runtime and connect to Gateway', async () => {
    const state = await runtime.init();

    expect(state.identity.name).toBe('integration-being');
    expect(runtime.getChannelManager()).not.toBeNull();
    expect(runtime.getChannelManager()!.isConnected()).toBe(true);
  });

  it('should list available channels from Gateway', async () => {
    await runtime.init();

    const channels = runtime.getChannelManager()!.getAvailableChannels();
    expect(channels).toContain('telegram');
    expect(channels).toContain('wechat');
  });

  it('Gateway message → Inbox → visible in perception during cycle', async () => {
    await runtime.init();

    // Simulate incoming message via Gateway
    gateway.sendToAll({
      type: 'message',
      payload: {
        Body: 'Hey, can you review my PR?',
        Channel: 'telegram',
        From: 'dev_alice',
        FromName: 'Alice',
        To: 'integration-being',
        ChatType: 'direct',
        MessageId: 'msg_integration_1',
      } satisfies OpenClawMessage,
    });

    await new Promise((r) => setTimeout(r, 200));

    // Inbox should have the message
    const inbox = runtime.getInbox();
    expect(inbox.getUnreadCount()).toBe(1);

    // Run a cycle — the being should perceive the inbox message
    const result = await runtime.cycle();
    expect(result.success).toBe(true);
    // With our stub LLM configured to reply, it should choose reply_message
    expect(result.action.type).toBe('reply_message');
  });

  it('Gateway message → auto-creates relation for sender', async () => {
    await runtime.init();

    gateway.sendToAll({
      type: 'message',
      payload: {
        Body: 'First contact!',
        Channel: 'wechat',
        From: 'wx_new_user',
        To: 'integration-being',
        ChatType: 'direct',
        MessageId: 'msg_integration_2',
      } satisfies OpenClawMessage,
    });

    await new Promise((r) => setTimeout(r, 200));

    const relations = runtime.getRelations();
    const people = await relations.listPeople();
    expect(people.some((p) => p.includes('wx_new_user'))).toBe(true);
  });

  it('runtime.stop() disconnects Gateway cleanly', async () => {
    await runtime.init();
    expect(runtime.getChannelManager()!.isConnected()).toBe(true);

    runtime.stop();
    await new Promise((r) => setTimeout(r, 100));

    expect(runtime.getChannelManager()!.isConnected()).toBe(false);
    expect(runtime.isRunning()).toBe(false);
  });

  it('full cycle with Gateway: init → message → cycle → memory recorded', async () => {
    await runtime.init();

    // Send a message
    gateway.sendToAll({
      type: 'message',
      payload: {
        Body: 'Integration test message for full cycle',
        Channel: 'telegram',
        From: 'tester',
        To: 'integration-being',
        ChatType: 'direct',
        MessageId: 'msg_full_cycle',
      } satisfies OpenClawMessage,
    });
    await new Promise((r) => setTimeout(r, 200));

    // Run a cycle
    const result = await runtime.cycle();
    expect(result.success).toBe(true);

    // Memory should record the cycle
    const memory = runtime.getMemory();
    const results = await memory.search('Cycle');
    expect(results.length).toBeGreaterThan(0);

    // Cycle count should be 1
    expect(runtime.getCycleCount()).toBe(1);
  });
});

describe('Integration: Runtime without Gateway (backwards compatible)', () => {
  let workspace: Awaited<ReturnType<typeof createWorkspace>>;
  let runtime: BeingRuntime;

  beforeEach(async () => {
    workspace = await createWorkspace();

    const config: BeingConfig = {
      workspacePath: join(workspace.tempDir, 'workspace'),
      beingFilePath: workspace.beingPath,
      valuesFilePath: workspace.valuesPath,
      heartbeatIntervalMs: 100,
      llm: new StubLLMProvider(),
      // No gateway config — should still work fine
    };

    runtime = new BeingRuntime(config);
  });

  afterEach(async () => {
    runtime.stop();
    await rm(workspace.tempDir, { recursive: true, force: true });
  });

  it('should init and run without Gateway', async () => {
    const state = await runtime.init();
    expect(state.identity.name).toBe('integration-being');
    expect(runtime.getChannelManager()).toBeNull();

    const result = await runtime.cycle();
    expect(result.success).toBe(true);
  });
});
