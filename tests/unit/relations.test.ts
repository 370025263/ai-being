import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelationsManager } from '../../src/social/relations.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';

describe('RelationsManager', () => {
  let tempDir: string;
  let relations: RelationsManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ai-being-test-'));
    relations = new RelationsManager(tempDir);
    await relations.init();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should create directory structure on init', () => {
    expect(existsSync(join(tempDir, 'relations', 'platforms'))).toBe(true);
    expect(existsSync(join(tempDir, 'relations', 'people'))).toBe(true);
    expect(existsSync(join(tempDir, 'relations', 'groups'))).toBe(true);
  });

  it('should create a new person relation', async () => {
    const relation = await relations.getOrCreatePerson('alice', 'telegram');
    expect(relation.name).toBe('alice');
    expect(relation.platform).toBe('telegram');
    expect(relation.interactionCount).toBe(0);
    expect(existsSync(relation.filePath)).toBe(true);
  });

  it('should return existing person on second call', async () => {
    const r1 = await relations.getOrCreatePerson('bob', 'wechat');
    const r2 = await relations.getOrCreatePerson('bob', 'wechat');
    expect(r1.filePath).toBe(r2.filePath);
  });

  it('should create platform cognition file', async () => {
    const platform = await relations.getOrCreatePlatform('telegram');
    expect(platform.name).toBe('telegram');
    expect(existsSync(platform.filePath)).toBe(true);
  });

  it('should update notes', async () => {
    const relation = await relations.getOrCreatePerson('alice', 'telegram');
    await relations.updateNotes(relation.filePath, 'Alice is a great developer who loves Rust.');

    const updated = await relations.getOrCreatePerson('alice', 'telegram');
    expect(updated.notes).toContain('great developer');
  });

  it('should record interactions', async () => {
    const relation = await relations.getOrCreatePerson('bob', 'github');
    await relations.recordInteraction(relation.filePath);
    await relations.recordInteraction(relation.filePath);

    const updated = await relations.getOrCreatePerson('bob', 'github');
    expect(updated.interactionCount).toBe(2);
  });

  it('should list people', async () => {
    await relations.getOrCreatePerson('alice', 'telegram');
    await relations.getOrCreatePerson('bob', 'github');

    const people = await relations.listPeople();
    expect(people).toHaveLength(2);
  });

  it('should list platforms', async () => {
    await relations.getOrCreatePlatform('telegram');
    await relations.getOrCreatePlatform('wechat');

    const platforms = await relations.listPlatforms();
    expect(platforms).toHaveLength(2);
  });

  it('should generate correct file path for person', () => {
    const path = relations.getPersonFilePath('Alice', 'telegram');
    expect(path).toContain('alice_telegram.md');
  });
});
