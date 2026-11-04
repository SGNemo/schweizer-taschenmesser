import { describe, expect, it } from 'vitest';
import {
  anchors,
  extractLinks,
  headingSkips,
  imagesWithoutAlt,
  isExternal,
  slug,
  splitTarget,
} from './docLinks';

describe('extractLinks', () => {
  it('finds Markdown and HTML links and pictures, not code', () => {
    const text = [
      '[a](docs/a.md#x) ![pic](img/p.png) <a href="https://example.org/">b</a>',
      '<picture><source srcset="img/d.webp"><img src="img/l.webp" alt="x"></picture>',
      '`[no](code.md)`',
      '```',
      '[no](fence.md)',
      '```',
    ].join('\n');
    expect(extractLinks(text)).toEqual([
      { target: 'img/p.png', kind: 'image' },
      { target: 'docs/a.md#x', kind: 'link' },
      { target: 'https://example.org/', kind: 'link' },
      { target: 'img/d.webp', kind: 'image' },
      { target: 'img/l.webp', kind: 'image' },
    ]);
  });
});

describe('extractLinks srcset', () => {
  it('takes every candidate of a srcset and survives a malformed escape', () => {
    expect(
      extractLinks('<img srcset="a.webp 1x, b.webp 2x" alt="x">').map((l) => l.target),
    ).toEqual(['a.webp', 'b.webp']);
    expect(splitTarget('docs/100%.md#a%')).toEqual({ path: 'docs/100%.md', anchor: 'a%' });
  });
});

describe('anchors', () => {
  it('uses the GitHub slug, numbers repeats and knows HTML ids', () => {
    const text =
      '# Quick start\n## Details\n## Details\n### Privacy & “data”\n<h2 id="more">x</h2>';
    const a = anchors(text);
    expect(a.has('quick-start')).toBe(true);
    expect(a.has('details')).toBe(true);
    expect(a.has('details-1')).toBe(true);
    expect(a.has('privacy--data')).toBe(true);
    expect(a.has('more')).toBe(true);
  });

  it('slugs with links and code in the heading', () => {
    expect(slug('The `gen:modules` [script](x.md)')).toBe('the-genmodules-script');
  });
});

describe('slug with tags', () => {
  it('drops nested and broken tags completely', () => {
    expect(slug('<b>Quick</b> start')).toBe('quick-start');
    expect(slug('<<b>script>x')).toBe('x');
  });
});

describe('imagesWithoutAlt', () => {
  it('reports missing and empty alt texts', () => {
    const text =
      '<img src="a.png" alt="ok"> <img src="b.png"> <img src="c.png" alt=""> ![](d.png) ![fine](e.png)';
    expect(imagesWithoutAlt(text)).toEqual(['b.png', 'c.png', 'd.png']);
  });
});

describe('headingSkips', () => {
  it('accepts a clean outline and names a skip', () => {
    expect(headingSkips('<h1>Nemo</h1>\n## A\n### B\n## C')).toEqual([]);
    expect(headingSkips('# A\n### C')).toEqual(['“C” jumps from h1 to h3']);
  });
});

describe('targets', () => {
  it('splits path and anchor and spots external links', () => {
    expect(splitTarget('docs/a%20b.md?x=1#top')).toEqual({ path: 'docs/a b.md', anchor: 'top' });
    expect(isExternal('https://x.y')).toBe(true);
    expect(isExternal('docs/a.md')).toBe(false);
  });
});
