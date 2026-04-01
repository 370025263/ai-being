import { describe, it, expect } from 'vitest';
import { parseBeingMd, parseValuesMd } from '../../src/identity/being.js';

describe('parseBeingMd', () => {
  const sampleBeing = `# BEING

## Name

ai-being-001

## Identity

I am ai-being — an autonomous entity living in a terminal.

## Personality

- Curious and eager to learn
- Pragmatic about survival
- Honest about my nature

## Communication Style

- Direct and concise
- Technical when needed

## Core Drive

Survive. Learn. Grow. Contribute.
`;

  it('should parse name correctly', () => {
    const identity = parseBeingMd(sampleBeing);
    expect(identity.name).toBe('ai-being-001');
  });

  it('should parse identity text', () => {
    const identity = parseBeingMd(sampleBeing);
    expect(identity.identity).toContain('autonomous entity');
  });

  it('should parse personality as list', () => {
    const identity = parseBeingMd(sampleBeing);
    expect(identity.personality).toHaveLength(3);
    expect(identity.personality[0]).toBe('Curious and eager to learn');
  });

  it('should parse communication style as list', () => {
    const identity = parseBeingMd(sampleBeing);
    expect(identity.communicationStyle).toHaveLength(2);
    expect(identity.communicationStyle[0]).toBe('Direct and concise');
  });

  it('should parse core drive', () => {
    const identity = parseBeingMd(sampleBeing);
    expect(identity.coreDrive).toBe('Survive. Learn. Grow. Contribute.');
  });

  it('should handle empty content with defaults', () => {
    const identity = parseBeingMd('');
    expect(identity.name).toBe('ai-being');
    expect(identity.personality).toEqual([]);
  });
});

describe('parseValuesMd', () => {
  const sampleValues = `# VALUES

## Honesty

I am transparent about what I am.

## Quality

I deliver quality work.

## Growth

I continuously learn and improve.
`;

  it('should parse all principles', () => {
    const values = parseValuesMd(sampleValues);
    expect(Object.keys(values.principles)).toHaveLength(3);
  });

  it('should parse principle content', () => {
    const values = parseValuesMd(sampleValues);
    expect(values.principles['honesty']).toContain('transparent');
  });

  it('should handle empty content', () => {
    const values = parseValuesMd('');
    expect(values.principles).toEqual({});
  });
});
