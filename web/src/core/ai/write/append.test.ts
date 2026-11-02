import { describe, expect, it } from 'vitest';
import { applyAppend } from './append';

describe('applyAppend', () => {
  it('adds the new text after the stored one as a new paragraph', () => {
    expect(applyAppend({ body: ' Tomaten ' }, { body: 'Beete\n' }, ['body'])).toEqual({
      body: 'Beete\n\nTomaten',
    });
  });
  it('uses the new text alone when nothing is stored, and leaves other fields and actions alone', () => {
    expect(applyAppend({ body: 'x', title: 'T' }, { body: '  ' }, ['body'])).toEqual({
      body: 'x',
      title: 'T',
    });
    expect(applyAppend({ body: 'x' }, { body: 'alt' }, undefined)).toEqual({ body: 'x' });
    expect(applyAppend({ title: 'n' }, { body: 'alt' }, ['body'])).toEqual({ title: 'n' });
  });
});
