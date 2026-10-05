// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown, parseBlocks, safeHref } from '../markdown';

describe('chat markdown', () => {
  it('never interprets HTML', () => {
    const { container } = render(
      <Markdown text={'<img src=x onerror=alert(1)> <script>x</script>'} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('only links http(s) and mailto, with noopener', () => {
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref('data:text/html,x')).toBeUndefined();
    expect(safeHref('https://example.org/a')).toBe('https://example.org/a');
    const { container } = render(
      <Markdown text={'[ok](https://example.org) [bad](javascript:alert(1))'} />,
    );
    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute('rel')).toBe('noopener noreferrer');
    expect(container.textContent).toContain('bad');
  });

  it('renders blocks: headings, lists, code, quotes', () => {
    const blocks = parseBlocks(
      '# Titel\n\n- a\n- b\n\n1. x\n2. y\n\n> Zitat\n\n```js\nconst a = 1;\n```\n',
    );
    expect(blocks.map((b) => b.type)).toEqual(['h', 'ul', 'ol', 'quote', 'code']);
    const { container } = render(<Markdown text={'**fett** und *schief* und `code`'} />);
    expect(container.querySelector('strong')?.textContent).toBe('fett');
    expect(container.querySelector('em')?.textContent).toBe('schief');
    expect(container.querySelector('code')?.textContent).toBe('code');
  });

  it('keeps an unfinished code block (streaming)', () => {
    const blocks = parseBlocks('```\nline 1\nline 2');
    expect(blocks).toEqual([{ type: 'code', lang: '', text: 'line 1\nline 2' }]);
  });
});
