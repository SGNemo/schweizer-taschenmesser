import { describe, expect, it } from 'vitest';
import { notesPreview } from './notes';

describe('notesPreview', () => {
  it('strips Markdown to plain lines and drops the title and the changelog link', () => {
    const md = [
      '## 1.2.0 (2026-10-01)',
      '',
      '### Features',
      '',
      '- **ai:** add Groq ([`abc1234`](https://github.com/o/r/commit/abc))',
      '- plain item',
      '',
      '**Full changelog:** https://github.com/o/r/compare/v1.1.0...v1.2.0',
    ].join('\n');
    expect(notesPreview(md)).toEqual(['Features', 'ai: add Groq (abc1234)', 'plain item']);
  });

  it('shortens long notes and keeps HTML inert (it is only ever rendered as text)', () => {
    const lines = Array.from({ length: 30 }, (_, i) => `- item ${i}`).join('\n');
    const preview = notesPreview(lines, 5);
    expect(preview).toHaveLength(6);
    expect(preview.at(-1)).toBe('…');
    expect(notesPreview('<img src=x onerror=alert(1)>')).toEqual(['<img src=x onerror=alert(1)>']);
  });

  it('handles empty notes', () => {
    expect(notesPreview('')).toEqual([]);
    expect(notesPreview('\n\n')).toEqual([]);
  });
});
