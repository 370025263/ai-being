/**
 * Relations — Manages social relationships across platforms.
 *
 * Each person/platform/group gets its own markdown file in relations/.
 * The AI reads and writes these files to maintain its social memory.
 */
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Relation } from '../types.js';

export class RelationsManager {
  private relationsDir: string;

  constructor(workspacePath: string) {
    this.relationsDir = join(workspacePath, 'relations');
  }

  async init(): Promise<void> {
    const dirs = ['platforms', 'people', 'groups'];
    for (const dir of dirs) {
      const path = join(this.relationsDir, dir);
      if (!existsSync(path)) {
        await mkdir(path, { recursive: true });
      }
    }
  }

  /**
   * Get or create a relation file for a person.
   */
  async getOrCreatePerson(name: string, platform: string): Promise<Relation> {
    const filename = `${this.sanitizeFilename(name)}_${platform}.md`;
    const filePath = join(this.relationsDir, 'people', filename);

    if (existsSync(filePath)) {
      return this.parseRelationFile(filePath, name, platform);
    }

    // Create new relation
    const relation: Relation = {
      id: `person_${name}_${platform}`,
      name,
      platform,
      filePath,
      notes: '',
      interactionCount: 0,
    };

    await this.persistRelation(relation);
    return relation;
  }

  /**
   * Get or create a platform cognition file.
   */
  async getOrCreatePlatform(platform: string): Promise<Relation> {
    const filename = `${this.sanitizeFilename(platform)}.md`;
    const filePath = join(this.relationsDir, 'platforms', filename);

    if (existsSync(filePath)) {
      return this.parseRelationFile(filePath, platform, platform);
    }

    const relation: Relation = {
      id: `platform_${platform}`,
      name: platform,
      platform,
      filePath,
      notes: '',
      interactionCount: 0,
    };

    await this.persistRelation(relation);
    return relation;
  }

  /**
   * Update notes about a person (AI writes its observations).
   */
  async updateNotes(filePath: string, notes: string): Promise<void> {
    if (!existsSync(filePath)) {
      throw new Error(`Relation file not found: ${filePath}`);
    }

    const content = await readFile(filePath, 'utf-8');
    const updatedContent = this.updateNotesSection(content, notes);
    await writeFile(filePath, updatedContent, 'utf-8');
  }

  /**
   * Record an interaction (increment count, update timestamp).
   */
  async recordInteraction(filePath: string): Promise<void> {
    if (!existsSync(filePath)) return;

    const content = await readFile(filePath, 'utf-8');
    const countMatch = content.match(/Interactions:\s*(\d+)/);
    const currentCount = countMatch ? parseInt(countMatch[1], 10) : 0;

    let updated = content.replace(
      /Interactions:\s*\d+/,
      `Interactions: ${currentCount + 1}`,
    );
    updated = updated.replace(
      /Last Interaction:\s*.+/,
      `Last Interaction: ${new Date().toISOString().split('T')[0]}`,
    );

    await writeFile(filePath, updated, 'utf-8');
  }

  /**
   * List all known people.
   */
  async listPeople(): Promise<string[]> {
    const dir = join(this.relationsDir, 'people');
    if (!existsSync(dir)) return [];
    const files = await readdir(dir);
    return files.filter(f => f.endsWith('.md'));
  }

  /**
   * List all known platforms.
   */
  async listPlatforms(): Promise<string[]> {
    const dir = join(this.relationsDir, 'platforms');
    if (!existsSync(dir)) return [];
    const files = await readdir(dir);
    return files.filter(f => f.endsWith('.md'));
  }

  /**
   * Get the file path for a person's relation file (for inbox summary linking).
   */
  getPersonFilePath(name: string, platform: string): string {
    const filename = `${this.sanitizeFilename(name)}_${platform}.md`;
    return join(this.relationsDir, 'people', filename);
  }

  private async parseRelationFile(filePath: string, name: string, platform: string): Promise<Relation> {
    const content = await readFile(filePath, 'utf-8');

    const countMatch = content.match(/Interactions:\s*(\d+)/);
    const lastMatch = content.match(/Last Interaction:\s*(.+)/);
    const notesMatch = content.match(/## Notes\n([\s\S]*?)(?=\n## |$)/);

    return {
      id: `${name}_${platform}`,
      name,
      platform,
      filePath,
      notes: notesMatch?.[1]?.trim() ?? '',
      interactionCount: countMatch ? parseInt(countMatch[1], 10) : 0,
      lastInteraction: lastMatch ? new Date(lastMatch[1].trim()) : undefined,
    };
  }

  private async persistRelation(relation: Relation): Promise<void> {
    const content = `# ${relation.name}

## Meta
- Platform: ${relation.platform}
- Interactions: ${relation.interactionCount}
- Last Interaction: ${relation.lastInteraction?.toISOString().split('T')[0] ?? 'never'}

## Notes
${relation.notes}
`;

    await writeFile(relation.filePath, content, 'utf-8');
  }

  private updateNotesSection(content: string, notes: string): string {
    const notesRegex = /## Notes\n[\s\S]*?(?=\n## |$)/;
    if (notesRegex.test(content)) {
      return content.replace(notesRegex, `## Notes\n${notes}`);
    }
    return content + `\n## Notes\n${notes}\n`;
  }

  private sanitizeFilename(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  }
}
