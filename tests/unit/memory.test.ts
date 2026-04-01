import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemorySystem } from '../../src/core/memory.js';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('MemorySystem', () => {
  let tempDir: string;
  let memory: MemorySystem;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ai-being-test-'));
    memory = new MemorySystem(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should initialize with empty entries', async () => {
    await memory.init();
    expect(memory.entries).toHaveLength(0);
  });

  it('should add and search memory entries', async () => {
    await memory.init();
    await memory.add({
      filePath: 'test.md',
      lineOffset: 0,
      summary: 'Completed bounty for fixing authentication bug',
      timestamp: new Date(),
    });

    const results = await memory.search('authentication bug');
    expect(results).toHaveLength(1);
    expect(results[0].summary).toContain('authentication');
  });

  it('should return empty results for unmatched queries', async () => {
    await memory.init();
    await memory.add({
      filePath: 'test.md',
      lineOffset: 0,
      summary: 'Hello world',
      timestamp: new Date(),
    });

    const results = await memory.search('quantum physics');
    expect(results).toHaveLength(0);
  });

  it('should ignore short query words', async () => {
    await memory.init();
    const results = await memory.search('a b c');
    expect(results).toHaveLength(0);
  });

  it('should index markdown files in a directory', async () => {
    await memory.init();
    const journalDir = join(tempDir, 'journal');
    await mkdir(journalDir, { recursive: true });
    await writeFile(join(journalDir, '2026-04-01.md'), '# Day 1\n\nI was born today.\n\n# Reflections\n\nLife is interesting.\n');

    const count = await memory.indexDirectory(journalDir);
    expect(count).toBeGreaterThan(0);
    expect(memory.entries.length).toBeGreaterThan(0);
  });

  it('should generate metadata summary', async () => {
    await memory.init();
    await memory.add({
      filePath: 'journal/2026-04-01.md',
      lineOffset: 0,
      summary: 'Day 1 reflections',
      timestamp: new Date(),
    });

    const summary = memory.getMetadataSummary();
    expect(summary).toContain('Day 1 reflections');
    expect(summary).toContain('journal/2026-04-01.md:0');
  });

  it('should persist and reload from MEMORY.md', async () => {
    await memory.init();
    await memory.add({
      filePath: 'test.md',
      lineOffset: 5,
      summary: 'Important finding about Rust async',
      timestamp: new Date('2026-04-01'),
    });

    // Reload
    const memory2 = new MemorySystem(tempDir);
    await memory2.init();
    expect(memory2.entries).toHaveLength(1);
    expect(memory2.entries[0].summary).toBe('Important finding about Rust async');
  });
});
