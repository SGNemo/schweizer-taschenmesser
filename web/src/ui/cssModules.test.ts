import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Top-level rule blocks of a CSS file whose selector is one plain class (`.name`), comments removed.
 * Blocks inside `@media` & co. are not counted: a breakpoint may adjust a class on purpose.
 */
function plainClassBlocks(css: string): string[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: string[] = [];
  let depth = 0;
  let selector = '';
  for (const ch of text) {
    if (ch === '{') {
      if (depth === 0 && /^\.[A-Za-z0-9_-]+$/.test(selector.trim())) out.push(selector.trim());
      depth++;
      selector = '';
    } else if (ch === '}') {
      depth--;
      selector = '';
    } else if (depth === 0) selector += ch;
  }
  return out;
}

/** Every `*.module.css` below `dir`, recursively. */
function cssModules(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return cssModules(path);
    return e.name.endsWith('.module.css') ? [path] : [];
  });
}

describe('CSS modules', () => {
  // One class written twice in a module is one class: FormActions shared `.actions` with the row
  // actions (opacity 0 until hovered), and every form's save button was invisible with a mouse.
  // A deliberate override goes into the one block; a different element gets its own name.
  it('no CSS module in src/ defines the same class in two top-level blocks', () => {
    const src = join(__dirname, '..');
    const files = cssModules(src);
    expect(files.length).toBeGreaterThan(50);
    const twice: string[] = [];
    for (const file of files) {
      const seen = new Set<string>();
      for (const cls of plainClassBlocks(readFileSync(file, 'utf8'))) {
        if (seen.has(cls)) twice.push(`${relative(src, file)} ${cls}`);
        seen.add(cls);
      }
    }
    expect(twice).toEqual([]);
  });

  it('the form buttons are never hidden like row actions', () => {
    const css = readFileSync(join(__dirname, 'Patterns.module.css'), 'utf8');
    const block = /\.formActions\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(block).toContain('display: flex');
    expect(block).not.toMatch(/opacity|visibility|display:\s*none/);
  });
});
