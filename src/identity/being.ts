/**
 * Identity Layer — Loads and manages BEING.md and VALUES.md
 *
 * Parses markdown identity files into structured data that the
 * cognition engine can use for decision-making and communication.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { BeingIdentity, BeingValues } from '../types.js';

/**
 * Parse a BEING.md file into a structured BeingIdentity.
 * Expected format:
 *   # BEING
 *   ## Name
 *   <name>
 *   ## Identity
 *   <identity text>
 *   ## Personality
 *   - trait1
 *   - trait2
 *   ## Communication Style
 *   - style1
 *   ## Core Drive
 *   <drive text>
 */
export function parseBeingMd(content: string): BeingIdentity {
  const sections = parseSections(content);

  return {
    name: sections['name']?.trim() ?? 'ai-being',
    identity: sections['identity']?.trim() ?? '',
    personality: parseList(sections['personality'] ?? ''),
    communicationStyle: parseList(sections['communication style'] ?? sections['communicationstyle'] ?? ''),
    coreDrive: sections['core drive']?.trim() ?? sections['coredrive']?.trim() ?? '',
  };
}

/**
 * Parse a VALUES.md file into a structured BeingValues.
 * Expected format:
 *   # VALUES
 *   ## PrincipleName
 *   Description text
 */
export function parseValuesMd(content: string): BeingValues {
  const sections = parseSections(content);
  const principles: Record<string, string> = {};

  for (const [key, value] of Object.entries(sections)) {
    if (key !== 'values' && value.trim()) {
      principles[key] = value.trim();
    }
  }

  return { principles };
}

/**
 * Load identity from filesystem.
 */
export async function loadIdentity(beingPath: string, valuesPath: string): Promise<{
  identity: BeingIdentity;
  values: BeingValues;
}> {
  if (!existsSync(beingPath)) {
    throw new Error(`BEING.md not found at: ${beingPath}`);
  }
  if (!existsSync(valuesPath)) {
    throw new Error(`VALUES.md not found at: ${valuesPath}`);
  }

  const [beingContent, valuesContent] = await Promise.all([
    readFile(beingPath, 'utf-8'),
    readFile(valuesPath, 'utf-8'),
  ]);

  return {
    identity: parseBeingMd(beingContent),
    values: parseValuesMd(valuesContent),
  };
}

// --- Internal helpers ---

function parseSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {};
  let currentSection = '';
  const lines = content.split('\n');

  for (const line of lines) {
    const headerMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headerMatch) {
      currentSection = headerMatch[1].toLowerCase().trim();
      sections[currentSection] = '';
    } else if (currentSection) {
      sections[currentSection] = (sections[currentSection] ?? '') + line + '\n';
    }
  }

  return sections;
}

function parseList(content: string): string[] {
  return content
    .split('\n')
    .map(line => line.replace(/^[-*]\s*/, '').trim())
    .filter(line => line.length > 0);
}
