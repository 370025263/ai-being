/**
 * Journal System — Writes daily/hourly journal entries to journal/ directory.
 *
 * Each entry is a standalone markdown file named by date (and optionally hour).
 * Journal entries are automatically committed to git for public visibility.
 */
import { writeFile, readFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { JournalEntry } from '../types.js';

export class Journal {
  private journalDir: string;

  constructor(workspacePath: string) {
    this.journalDir = join(workspacePath, 'journal');
  }

  async init(): Promise<void> {
    if (!existsSync(this.journalDir)) {
      await mkdir(this.journalDir, { recursive: true });
    }
  }

  /**
   * Write a journal entry. Uses date-based filename.
   * If an entry for today already exists, appends to it.
   * If hourly=true, creates a separate file per hour.
   */
  async write(content: string, options?: { hourly?: boolean }): Promise<JournalEntry> {
    await this.init();

    const now = new Date();
    const filename = options?.hourly
      ? this.hourlyFilename(now)
      : this.dailyFilename(now);

    const filePath = join(this.journalDir, filename);
    const timestamp = this.formatTimestamp(now);

    let existingContent = '';
    if (existsSync(filePath)) {
      existingContent = await readFile(filePath, 'utf-8');
    } else {
      existingContent = `# Journal — ${this.formatDate(now)}\n\n`;
    }

    const entry = `## ${timestamp}\n\n${content}\n\n---\n\n`;
    await writeFile(filePath, existingContent + entry, 'utf-8');

    return {
      date: now,
      content,
      filePath,
    };
  }

  /**
   * List all journal files, sorted by date descending.
   */
  async list(): Promise<string[]> {
    await this.init();
    const files = await readdir(this.journalDir);
    return files
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse();
  }

  /**
   * Read a specific journal entry by filename.
   */
  async read(filename: string): Promise<string> {
    const filePath = join(this.journalDir, filename);
    if (!existsSync(filePath)) {
      throw new Error(`Journal entry not found: ${filename}`);
    }
    return readFile(filePath, 'utf-8');
  }

  /**
   * Get today's journal file path (for the survival loop to check).
   */
  todayFilename(): string {
    return this.dailyFilename(new Date());
  }

  private dailyFilename(date: Date): string {
    return `${this.formatDate(date)}.md`;
  }

  private hourlyFilename(date: Date): string {
    const hour = date.getHours().toString().padStart(2, '0');
    return `${this.formatDate(date)}_${hour}.md`;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private formatTimestamp(date: Date): string {
    return date.toISOString().replace('T', ' ').split('.')[0];
  }
}
