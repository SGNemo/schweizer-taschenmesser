import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApiPrompt } from './prompt';

describe('AI prompt for the local API', () => {
  it('names the address and the workflow but no token', () => {
    const text = buildApiPrompt(50123);
    expect(text).toContain('http://127.0.0.1:50123/v1/modules');
    expect(text).toContain('dryRun=true');
    expect(text).toContain('Idempotency-Key');
    expect(text).toContain('Bearer <TOKEN>');
    expect(text).not.toMatch(/tm_[A-Za-z0-9_-]{10,}/);
  });
});

describe('docs/AI-IMPORT.md', () => {
  it('shows exactly the prompt the app copies', () => {
    const doc = readFileSync(resolve(process.cwd(), '../docs/AI-IMPORT.md'), 'utf8');
    expect(doc).toContain(buildApiPrompt(47631));
    expect(doc).not.toMatch(/tm_[A-Za-z0-9_-]{10,}/);
  });
});
