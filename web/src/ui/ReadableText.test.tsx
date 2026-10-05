// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useUiStore } from '@/stores/ui';
import { ReadableText } from './ReadableText';

afterEach(() => {
  const ui = useUiStore.getState();
  ui.setReadAid(false);
  ui.setReadScope('text');
  ui.setReadShare('40');
});

describe('ReadableText', () => {
  it('renders the plain string while the aid is off (default)', () => {
    const { container } = render(<ReadableText text="Urlaubsplanung besprechen" />);
    expect(container.innerHTML).toBe('Urlaubsplanung besprechen');
  });

  it('marks word starts without changing the text or adding semantics', () => {
    useUiStore.getState().setReadAid(true);
    const { container } = render(
      <p>
        <ReadableText text="Urlaubsplanung 1.234,56 € besprechen" />
      </p>,
    );
    expect(container.textContent).toBe('Urlaubsplanung 1.234,56 € besprechen');
    expect(container.querySelectorAll('b, strong, [role], [aria-label]').length).toBe(0);
    expect([...container.querySelectorAll('[data-rs]')].map((e) => e.textContent)).toEqual([
      'Urlaub',
      'besp',
    ]);
  });

  it('list text follows the scope; prose does not', () => {
    useUiStore.getState().setReadAid(true);
    const list = render(<ReadableText text="Urlaubsplanung" kind="list" />);
    expect(list.container.querySelector('[data-rs]')).toBeNull();
    useUiStore.getState().setReadScope('lists');
    const again = render(<ReadableText text="Urlaubsplanung" kind="list" />);
    expect(again.container.querySelector('[data-rs]')).not.toBeNull();
  });

  it('force (Fokus-Lesen) works with the aid off', () => {
    const { container } = render(<ReadableText text="Urlaubsplanung" force />);
    expect(container.querySelector('[data-rs]')).not.toBeNull();
  });
});

describe('where the reading aid must never appear', () => {
  const root = resolve(__dirname, '..');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.(tsx?|jsx?)$/.test(f) ? [p] : [];
    });
  it('the vault and accounts modules and the form fields do not use it', () => {
    const forbidden = [
      ...files(join(root, 'modules/vault')),
      ...files(join(root, 'modules/accounts')),
      join(root, 'ui/Fields.tsx'),
      join(root, 'ui/Button.tsx'),
    ];
    for (const f of forbidden)
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/ReadableText|ReaderView/);
  });
});
