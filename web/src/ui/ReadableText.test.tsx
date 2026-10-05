// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ReadAidContext, type ReadAidConfig } from '@/core/text/ReadableText';
import { NoReadAid, ReadableText } from './ReadableText';

const on = (cover: ReadAidConfig['cover']): ReadAidConfig => ({
  cover,
  share: 0.4,
  blocked: false,
});
const wrap = (cfg: ReadAidConfig, ui: ReactNode) =>
  render(<ReadAidContext.Provider value={cfg}>{ui}</ReadAidContext.Provider>);

afterEach(() => document.body.replaceChildren());

describe('ReadableText', () => {
  it('renders the plain string while the aid is off (default)', () => {
    const { container } = render(<ReadableText text="Urlaubsplanung besprechen" />);
    expect(container.innerHTML).toBe('Urlaubsplanung besprechen');
  });

  it('marks word starts without changing the text or adding semantics', () => {
    const { container } = wrap(
      on(25),
      <p>
        <ReadableText text="Urlaubsplanung 1.234,56 € besprechen" tone="ink" />
      </p>,
    );
    expect(container.textContent).toBe('Urlaubsplanung 1.234,56 € besprechen');
    expect(container.querySelectorAll('b, strong, [role], [aria-label]').length).toBe(0);
    expect([...container.querySelectorAll('[data-rs]')].map((e) => e.textContent)).toEqual([
      'Urlaub',
      'besp',
    ]);
    // In primary-ink text the rest of each word is dimmed (a word-less gap like "1.234,56 €" is not wrapped).
    expect([...container.querySelectorAll('[data-rr]')].map((e) => e.textContent)).toEqual([
      'splanung',
      'rechen',
    ]);
  });

  it('plain tone changes only the weight (no dimmed rest)', () => {
    const { container } = wrap(on(100), <ReadableText text="Urlaubsplanung" />);
    expect(container.querySelector('[data-rs]')).not.toBeNull();
    expect(container.querySelector('[data-rr]')).toBeNull();
  });

  it('follows the coverage level: 25 prose, 50 headings/lists, 75 labels, 100 controls', () => {
    const levels = [25, 50, 75, 100] as const;
    for (const cover of levels) {
      for (const level of levels) {
        const { container, unmount } = wrap(
          on(cover),
          <ReadableText text="Urlaubsplanung" level={level} />,
        );
        expect(container.querySelector('[data-rs]') !== null, `cover ${cover} level ${level}`).toBe(
          cover >= level,
        );
        unmount();
      }
    }
  });

  it('force (Fokus-Lesen) works with the aid off, but never inside NoReadAid', () => {
    const { container } = render(<ReadableText text="Urlaubsplanung" force />);
    expect(container.querySelector('[data-rs]')).not.toBeNull();
    const blocked = wrap(
      on(100),
      <NoReadAid>
        <ReadableText text="Urlaubsplanung" force level={25} />
      </NoReadAid>,
    );
    expect(blocked.container.querySelector('[data-rs]')).toBeNull();
  });
});

describe('the JSX runtime hands plain text children to the reading aid', () => {
  it('wraps text of ordinary elements by level, skips inputs, code and numbers', () => {
    const { container } = wrap(
      on(100),
      <div>
        <h2>Überschrift Wochenplan</h2>
        <p>Fließtext mit Wörtern</p>
        <button type="button">Speichern</button>
        <code>geheimerSchluessel</code>
        <textarea defaultValue="Notizentext" />
        <span className="num">1.234,56 €</span>
      </div>,
    );
    const strong = (sel: string) =>
      [...container.querySelectorAll(`${sel} [data-rs]`)].map((e) => e.textContent);
    expect(strong('h2')).toEqual(['Über', 'Woch']);
    expect(container.querySelector('h2 [data-rs]')?.getAttribute('data-rs')).toBe('h');
    expect(strong('p')).toEqual(['Flie', 'Wör']);
    expect(strong('button')).toEqual(['Spei']);
    expect(container.querySelector('code [data-rs]')).toBeNull();
    expect(container.querySelector('textarea [data-rs]')).toBeNull();
    expect(container.querySelector('.num [data-rs]')).toBeNull();
  });

  it('headings in the primary ink get a dimmed rest; body text only changes weight', () => {
    const { container } = wrap(
      on(100),
      <div>
        <h2>Wochenplan</h2>
        <p>Wochenplan</p>
      </div>,
    );
    expect(container.querySelector('h2 [data-rr]')?.textContent).toBe('enplan');
    expect(container.querySelector('p [data-rr]')).toBeNull();
  });

  it('does nothing at coverage 25 for headings and buttons', () => {
    const { container } = wrap(
      on(25),
      <div>
        <h2>Überschrift</h2>
        <button type="button">Speichern</button>
        <p>Fließtext</p>
      </div>,
    );
    expect(container.querySelector('h2 [data-rs]')).toBeNull();
    expect(container.querySelector('button [data-rs]')).toBeNull();
    expect(container.querySelector('p [data-rs]')).not.toBeNull();
  });
});

describe('where the reading aid must never appear', () => {
  const root = resolve(__dirname, '..');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.(tsx?|jsx?)$/.test(f) ? [p] : [];
    });
  it('the vault and accounts routes are wrapped in NoReadAid', () => {
    const router = readFileSync(join(root, 'router.tsx'), 'utf8');
    expect(router).toMatch(/NO_READ_AID_MODULES[^;]*'vault'[^;]*'accounts'/);
    expect(router).toMatch(/<NoReadAid>/);
  });
  it('no module or form field opts in by itself (only the runtime does)', () => {
    for (const f of [
      ...files(join(root, 'modules/vault')),
      ...files(join(root, 'modules/accounts')),
    ])
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/ReadableText|ReaderView/);
  });
});
