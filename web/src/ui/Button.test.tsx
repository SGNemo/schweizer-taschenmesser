// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { Button, IconButton, IconLink } from './Button';
import { Card } from './Card';

describe('Button', () => {
  it('is a button of type "button" unless told otherwise', () => {
    render(<Button>Speichern</Button>);
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveAttribute('type', 'button');
  });

  it('offers the full hierarchy and a small row size', () => {
    render(
      <>
        <Button variant="primary">A</Button>
        <Button variant="quietDanger" size="sm">
          B
        </Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'B' }).className).toMatch(/quietDanger/);
    expect(screen.getByRole('button', { name: 'B' }).className).toMatch(/sm/);
    expect(screen.getByRole('button', { name: 'A' }).className).not.toMatch(/\bsm\b/);
  });

  it('carries its variant as data-variant, whatever the caller passes', () => {
    render(
      <MemoryRouter>
        <Button variant="primary">Anlegen</Button>
        <Button>Abbrechen</Button>
        <Button variant="danger" {...{ 'data-variant': 'primary' }}>
          Löschen
        </Button>
        <IconButton label="Mehr">
          <span />
        </IconButton>
        <IconButton label="Senden" variant="primary">
          <span />
        </IconButton>
        <IconLink label="Öffnen" to="/x">
          <span />
        </IconLink>
      </MemoryRouter>,
    );
    const variant = (role: 'button' | 'link', name: string) =>
      screen.getByRole(role, { name }).getAttribute('data-variant');
    expect(variant('button', 'Anlegen')).toBe('primary');
    expect(variant('button', 'Abbrechen')).toBe('secondary');
    expect(variant('button', 'Löschen')).toBe('danger');
    expect(variant('button', 'Mehr')).toBe('ghost');
    expect(variant('button', 'Senden')).toBe('primary');
    expect(variant('link', 'Öffnen')).toBe('ghost');
    expect(document.querySelectorAll('[data-variant="primary"]')).toHaveLength(2);
  });

  it('an icon button needs and exposes its label', () => {
    render(
      <IconButton label="Schließen">
        <span />
      </IconButton>,
    );
    expect(screen.getByRole('button', { name: 'Schließen' })).toHaveAttribute('title', 'Schließen');
  });
});

/** Rule blocks of a CSS source as `[selector, body]`, comments removed (flat files only: no nesting, no at-rules). */
function ruleBlocks(css: string): [selector: string, body: string][] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1]!.trim(), m[2]!.trim()]);
}

describe('disabled state (AE1)', () => {
  const uiDir = join(process.cwd(), 'src/ui');
  const buttonCss = ruleBlocks(readFileSync(join(uiDir, 'Button.module.css'), 'utf8'));
  const body = (selector: string) => buttonCss.find(([s]) => s === selector)?.[1] ?? '';

  it('a disabled button stays a disabled button for assistive tech and the mouse', () => {
    let clicks = 0;
    render(
      <Button variant="primary" disabled onClick={() => clicks++}>
        Entsperren
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Entsperren' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-variant', 'primary');
    button.click();
    expect(clicks).toBe(0);
  });

  // Opacity over the filled accent mixed into a muddy brown on the dark theme: it read as a colour bug, not as
  // "locked". The state is its own look now: neutral surface, quiet but readable text, no accent, no danger.
  it('is a neutral surface with quiet text, one rule for every variant', () => {
    const disabled = body('.btn:disabled');
    expect(disabled).toContain('background: var(--surface-sunken);');
    // A quiet edge keeps the outline of a button: the control frame, weakened, never the accent.
    expect(disabled).toMatch(
      /border-color: color-mix\(in srgb, var\(--border-strong\) \d+%, transparent\);/,
    );
    expect(disabled).toContain('color: var(--text-3);');
    expect(disabled).toContain('cursor: not-allowed;');
    expect(disabled).not.toMatch(/--accent|--danger|opacity/);
    // `.btn:disabled` outranks the one-class variant rules, so primary, secondary and danger cannot leak through …
    for (const variant of ['.primary', '.secondary', '.danger']) {
      expect(body(variant), variant).toMatch(/background:/);
      expect(buttonCss.some(([s]) => s.startsWith(`${variant}:disabled`))).toBe(false);
    }
    // … and no variant paints a hover on top of it.
    for (const [selector] of buttonCss) {
      if (selector.includes(':hover')) expect(selector, selector).toContain(':not(:disabled)');
    }
  });

  it('the quiet variants stay without a surface and never bring colour back', () => {
    const quiet = body('.ghost:disabled,\n.quietDanger:disabled');
    expect(quiet).toContain('background: transparent;');
    expect(quiet).not.toMatch(/(^|\s)color:|--accent|--danger|opacity/);
  });

  it('a control locked by attribute (`data-disabled`, the file picker) is not faded either, in any folder of ui/', () => {
    const offenders: string[] = [];
    const files = (readdirSync(uiDir, { recursive: true }) as string[])
      .map((f) => f.split('\\').join('/'))
      .filter((f) => f.endsWith('.module.css'));
    for (const file of files)
      for (const [selector, rules] of ruleBlocks(readFileSync(join(uiDir, file), 'utf8'))) {
        const locked = selector
          .split(',')
          .some((sel) =>
            /:disabled|\[disabled|\[data-disabled/.test(sel.replace(/:not\([^)]*\)/g, '')),
          );
        if (locked && /(^|[\s;])opacity\s*:/.test(rules)) offenders.push(`${file}: ${selector}`);
      }
    expect(offenders).toEqual([]);
  });

  it('no shared component fades or colours a :disabled control', () => {
    const offenders: string[] = [];
    for (const file of readdirSync(uiDir).filter((f) => f.endsWith('.module.css'))) {
      for (const [selector, rules] of ruleBlocks(readFileSync(join(uiDir, file), 'utf8'))) {
        if (!selector.includes(':disabled') || selector.includes(':not(:disabled)')) continue;
        if (/opacity|--accent|--danger/.test(rules)) offenders.push(`${file}: ${selector}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('Card', () => {
  it('groups content under an optional heading', () => {
    render(
      <Card title="Konto">
        <p>Inhalt</p>
      </Card>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Konto' })).toBeVisible();
    expect(screen.getByText('Inhalt')).toBeVisible();
  });
});
