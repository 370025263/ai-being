import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Journal } from '../../src/identity/journal.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';

describe('Journal', () => {
  let tempDir: string;
  let journal: Journal;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ai-being-test-'));
    journal = new Journal(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should create journal directory on init', async () => {
    await journal.init();
    expect(existsSync(join(tempDir, 'journal'))).toBe(true);
  });

  it('should write a daily journal entry', async () => {
    const entry = await journal.write('Today I was born.');
    expect(entry.content).toBe('Today I was born.');
    expect(entry.filePath).toContain('.md');
    expect(existsSync(entry.filePath)).toBe(true);
  });

  it('should append to existing daily entry', async () => {
    await journal.write('First entry.');
    await journal.write('Second entry.');

    const files = await journal.list();
    expect(files.length).toBe(1); // Same day = same file

    const content = await journal.read(files[0]);
    expect(content).toContain('First entry.');
    expect(content).toContain('Second entry.');
  });

  it('should write hourly entries as separate files', async () => {
    await journal.write('Hourly entry.', { hourly: true });
    const files = await journal.list();
    expect(files.length).toBeGreaterThanOrEqual(1);
    expect(files[0]).toMatch(/_\d{2}\.md$/); // contains hour suffix
  });

  it('should list journal files in reverse chronological order', async () => {
    await journal.write('Entry 1.');
    const files = await journal.list();
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it('should throw when reading non-existent entry', async () => {
    await expect(journal.read('nonexistent.md')).rejects.toThrow();
  });

  it('should return today filename', () => {
    const filename = journal.todayFilename();
    const today = new Date().toISOString().split('T')[0];
    expect(filename).toBe(`${today}.md`);
  });
});
