import { expect, it } from 'vitest';
import { changedFields } from './patch';

it('keeps only what the editor changed, including cleared fields', () => {
  const base = { title: 'Alt', note: 'Notiz', tags: ['a'], priority: 1, id: 'x' };
  expect(changedFields(base, { title: 'Alt', note: undefined, tags: ['a'], priority: 2 })).toEqual({
    note: undefined,
    priority: 2,
  });
  expect('note' in changedFields(base, { note: undefined })).toBe(true);
  expect(changedFields(base, { title: 'Alt', tags: ['a'] })).toEqual({});
});
