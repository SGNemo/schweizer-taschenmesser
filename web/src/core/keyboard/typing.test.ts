// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { isTypingTarget } from './typing';

describe('isTypingTarget', () => {
  it('is true for text fields and editable content only', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('select'))).toBe(true);
    const editable = document.createElement('div');
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    for (const type of ['checkbox', 'radio', 'range', 'file']) {
      const input = document.createElement('input');
      input.type = type;
      expect(isTypingTarget(input), type).toBe(false);
    }
    const date = document.createElement('input');
    date.type = 'date';
    expect(isTypingTarget(date)).toBe(true);
    expect(isTypingTarget(null)).toBe(false);
  });
});
