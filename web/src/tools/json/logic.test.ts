import { describe, expect, it } from 'vitest';
import { parseJson } from './logic';

describe('parseJson', () => {
  it('formats and minifies', () => {
    const r = parseJson('{"a": [1,  2], "b": {"c": null}}');
    expect(r).toMatchObject({ ok: true, minified: '{"a":[1,2],"b":{"c":null}}' });
    expect(r.ok && r.pretty).toBe(
      '{\n  "a": [\n    1,\n    2\n  ],\n  "b": {\n    "c": null\n  }\n}',
    );
  });
  it('accepts scalars', () => {
    expect(parseJson('"x"')).toMatchObject({ ok: true, minified: '"x"' });
  });
  it('reports errors', () => {
    const r = parseJson('{a:1}');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message.length).toBeGreaterThan(0);
  });
});
