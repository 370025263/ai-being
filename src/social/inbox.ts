/**
 * Inbox — Receives messages and generates metadata summaries.
 *
 * Core design principle: messages are stored as files (no token cost).
 * The AI only sees a metadata summary and decides what to read.
 * This is the anti-DDoS mechanism — 1000 messages = a few lines of metadata.
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { InboxMessage, InboxSummary, InboxSummaryEntry } from '../types.js';

export class Inbox {
  private messages: InboxMessage[] = [];
  private inboxDir: string;

  constructor(workspacePath: string) {
    this.inboxDir = join(workspacePath, 'inbox');
  }

  async init(): Promise<void> {
    if (!existsSync(this.inboxDir)) {
      await mkdir(this.inboxDir, { recursive: true });
    }
  }

  /**
   * Receive a message. It gets stored as a file, not sent to LLM.
   */
  async receive(message: Omit<InboxMessage, 'id' | 'read'>): Promise<InboxMessage> {
    const msg: InboxMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      read: false,
    };

    this.messages.push(msg);
    return msg;
  }

  /**
   * Generate a metadata summary — this is what the AI sees.
   * Grouped by sender, with counts and previews. No full content.
   */
  generateSummary(): InboxSummary {
    const unread = this.messages.filter(m => !m.read);
    const grouped = new Map<string, InboxMessage[]>();

    for (const msg of unread) {
      const key = `${msg.source}:${msg.sender}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(msg);
    }

    const entries: InboxSummaryEntry[] = [];
    for (const [, msgs] of grouped) {
      const latest = msgs[msgs.length - 1];
      entries.push({
        source: latest.source,
        sender: latest.sender,
        count: msgs.length,
        lastTimestamp: latest.timestamp,
        preview: latest.content.slice(0, 60) + (latest.content.length > 60 ? '...' : ''),
      });
    }

    // Sort by most recent first
    entries.sort((a, b) => b.lastTimestamp.getTime() - a.lastTimestamp.getTime());

    // Platform stats
    const platformStats: Record<string, { unread: number; conversations: number }> = {};
    for (const [key, msgs] of grouped) {
      const platform = key.split(':')[0];
      if (!platformStats[platform]) {
        platformStats[platform] = { unread: 0, conversations: 0 };
      }
      platformStats[platform].unread += msgs.length;
      platformStats[platform].conversations++;
    }

    return {
      timestamp: new Date(),
      entries,
      platformStats,
    };
  }

  /**
   * Render the summary as markdown (what gets written to inbox/summary.md).
   */
  renderSummaryMarkdown(summary: InboxSummary): string {
    const header = `# Inbox Summary — ${summary.timestamp.toISOString().replace('T', ' ').split('.')[0]}\n\n`;

    if (summary.entries.length === 0) {
      return header + 'No unread messages.\n';
    }

    let md = header + '## Unread Messages\n\n';
    md += '| Source | Sender | Count | Last | Preview |\n';
    md += '|--------|--------|-------|------|---------|\n';

    for (const entry of summary.entries) {
      const ago = this.formatTimeAgo(entry.lastTimestamp);
      md += `| ${entry.source} | ${entry.sender} | ${entry.count} | ${ago} | ${entry.preview} |\n`;
    }

    md += '\n## Platform Stats\n';
    for (const [platform, stats] of Object.entries(summary.platformStats)) {
      md += `- ${platform}: ${stats.unread} unread / ${stats.conversations} conversations\n`;
    }

    return md;
  }

  /**
   * The AI decided to read messages from a specific sender.
   * Returns full content and marks as read.
   */
  readMessages(sender: string, source?: string): InboxMessage[] {
    const matching = this.messages.filter(m =>
      !m.read &&
      m.sender === sender &&
      (source === undefined || m.source === source),
    );

    for (const msg of matching) {
      msg.read = true;
    }

    return matching;
  }

  /**
   * Get total unread count.
   */
  getUnreadCount(): number {
    return this.messages.filter(m => !m.read).length;
  }

  /**
   * Write summary to disk.
   */
  async persistSummary(): Promise<void> {
    await this.init();
    const summary = this.generateSummary();
    const md = this.renderSummaryMarkdown(summary);
    await writeFile(join(this.inboxDir, 'summary.md'), md, 'utf-8');
  }

  private formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}hr ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
}
