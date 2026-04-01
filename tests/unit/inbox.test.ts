import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Inbox } from '../../src/social/inbox.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Inbox', () => {
  let tempDir: string;
  let inbox: Inbox;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ai-being-test-'));
    inbox = new Inbox(tempDir);
    await inbox.init();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should receive messages', async () => {
    const msg = await inbox.receive({
      source: 'telegram',
      sender: 'bob',
      content: 'Hey, need help with Rust',
      timestamp: new Date(),
    });

    expect(msg.id).toBeDefined();
    expect(msg.read).toBe(false);
    expect(inbox.getUnreadCount()).toBe(1);
  });

  it('should generate summary grouped by sender', async () => {
    await inbox.receive({ source: 'telegram', sender: 'bob', content: 'msg 1', timestamp: new Date() });
    await inbox.receive({ source: 'telegram', sender: 'bob', content: 'msg 2', timestamp: new Date() });
    await inbox.receive({ source: 'wechat', sender: 'alice', content: 'hello', timestamp: new Date() });

    const summary = inbox.generateSummary();
    expect(summary.entries).toHaveLength(2); // bob and alice
    expect(summary.platformStats['telegram'].unread).toBe(2);
    expect(summary.platformStats['wechat'].unread).toBe(1);
  });

  it('should show preview in summary (truncated)', async () => {
    const longMsg = 'A'.repeat(100);
    await inbox.receive({ source: 'telegram', sender: 'bob', content: longMsg, timestamp: new Date() });

    const summary = inbox.generateSummary();
    expect(summary.entries[0].preview.length).toBeLessThanOrEqual(63); // 60 + "..."
  });

  it('should mark messages as read when AI decides to read them', async () => {
    await inbox.receive({ source: 'telegram', sender: 'bob', content: 'msg 1', timestamp: new Date() });
    await inbox.receive({ source: 'telegram', sender: 'bob', content: 'msg 2', timestamp: new Date() });
    await inbox.receive({ source: 'wechat', sender: 'alice', content: 'hello', timestamp: new Date() });

    const bobMsgs = inbox.readMessages('bob', 'telegram');
    expect(bobMsgs).toHaveLength(2);
    expect(inbox.getUnreadCount()).toBe(1); // only alice left
  });

  it('should show empty summary when no messages', () => {
    const summary = inbox.generateSummary();
    expect(summary.entries).toHaveLength(0);
  });

  it('should render summary as markdown', async () => {
    await inbox.receive({ source: 'telegram', sender: 'bob', content: 'urgent: prod is down', timestamp: new Date() });

    const summary = inbox.generateSummary();
    const md = inbox.renderSummaryMarkdown(summary);
    expect(md).toContain('Inbox Summary');
    expect(md).toContain('bob');
    expect(md).toContain('telegram');
    expect(md).toContain('urgent: prod is down');
  });

  it('should render empty markdown when no unread', () => {
    const summary = inbox.generateSummary();
    const md = inbox.renderSummaryMarkdown(summary);
    expect(md).toContain('No unread messages');
  });

  it('should persist summary to disk', async () => {
    await inbox.receive({ source: 'telegram', sender: 'bob', content: 'test', timestamp: new Date() });
    await inbox.persistSummary();

    const { existsSync } = await import('node:fs');
    expect(existsSync(join(tempDir, 'inbox', 'summary.md'))).toBe(true);
  });
});
