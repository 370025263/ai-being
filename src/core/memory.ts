/**
 * Memory Layer — Manages long-term memory with embedding-based retrieval.
 *
 * All knowledge is stored as markdown files. The memory system maintains
 * an index of (filePath, lineOffset, summary) metadata that the AI can
 * search through semantically, then decide whether to read the full content.
 *
 * For MVP, embedding is stubbed — uses keyword matching.
 * Will be replaced with real embedding + sqlite-vec later.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { MemoryEntry, MemoryIndex } from '../types.js';

export class MemorySystem implements MemoryIndex {
  entries: MemoryEntry[] = [];
  private workspacePath: string;
  private memoryFilePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.memoryFilePath = join(workspacePath, 'MEMORY.md');
  }

  /**
   * Initialize: load existing MEMORY.md and build index from workspace files.
   */
  async init(): Promise<void> {
    if (existsSync(this.memoryFilePath)) {
      const content = await readFile(this.memoryFilePath, 'utf-8');
      this.entries = this.parseMemoryFile(content);
    }
  }

  /**
   * Search memories by keyword matching (stub for embedding search).
   * Returns entries whose summary contains any of the query words.
   */
  async search(query: string): Promise<MemoryEntry[]> {
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (queryWords.length === 0) return [];

    const scored = this.entries.map(entry => {
      const text = `${entry.summary} ${entry.filePath}`.toLowerCase();
      const score = queryWords.reduce(
        (sum, word) => sum + (text.includes(word) ? 1 : 0),
        0,
      );
      return { entry, score };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(s => s.entry);
  }

  /**
   * Add a new memory entry and persist to MEMORY.md.
   */
  async add(entry: MemoryEntry): Promise<void> {
    this.entries.push(entry);
    await this.persist();
  }

  /**
   * Index all markdown files in a directory into memory entries.
   * Extracts headings and first lines as summaries with line offsets.
   */
  async indexDirectory(dirPath: string): Promise<number> {
    if (!existsSync(dirPath)) return 0;

    const files = await readdir(dirPath);
    const mdFiles = files.filter(f => f.endsWith('.md'));
    let count = 0;

    for (const file of mdFiles) {
      const filePath = join(dirPath, file);
      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Index headings and non-empty lines after headings
        if (line.startsWith('#') || (line.trim().length > 20 && i > 0 && lines[i - 1].startsWith('#'))) {
          const summary = line.startsWith('#')
            ? line.replace(/^#+\s*/, '')
            : line.trim().slice(0, 100);

          this.entries.push({
            filePath,
            lineOffset: i,
            summary,
            timestamp: new Date(),
          });
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Get all entries as a formatted metadata summary (for AI to read).
   * This is what gets injected into the context — not the full files.
   */
  getMetadataSummary(maxEntries = 50): string {
    const recent = this.entries.slice(-maxEntries);
    if (recent.length === 0) return 'No memories recorded yet.';

    const lines = recent.map(e => {
      const date = e.timestamp.toISOString().split('T')[0];
      return `- [${date}] ${e.summary} (${e.filePath}:${e.lineOffset})`;
    });

    return `# Memory Index (${this.entries.length} entries)\n\n${lines.join('\n')}`;
  }

  private parseMemoryFile(content: string): MemoryEntry[] {
    const entries: MemoryEntry[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^- \[(\d{4}-\d{2}-\d{2})\] (.+?) \((.+?):(\d+)\)$/);
      if (match) {
        entries.push({
          timestamp: new Date(match[1]),
          summary: match[2],
          filePath: match[3],
          lineOffset: parseInt(match[4], 10),
        });
      }
    }

    return entries;
  }

  private async persist(): Promise<void> {
    const content = this.getMetadataSummary(this.entries.length);
    await writeFile(this.memoryFilePath, content, 'utf-8');
  }
}
