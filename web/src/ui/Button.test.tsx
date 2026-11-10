// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

/** A stylesheet of `ui/` without its comments. */
const sheet = (name: string): string =>
  readFileSync(resolve(__dirname, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('disabled state (UI audit 2026-11, AE1)', () => {
  it('a disabled button stays a button with its variant; the state comes from :disabled alone', () => {
    render(
      <Button variant="primary" disabled>
        Entsperren
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Entsperren' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-variant', 'primary');
  });

  it('is a state of its own: sunken surface, --text-3, no accent, the same for primary, secondary and danger', () => {
    const css = sheet('Button.module.css');
    const filled =
      /\.primary:disabled,\s*\.secondary:disabled,\s*\.danger:disabled,\s*\.icon\.ghost:disabled\s*\{([^}]*)\}/.exec(
        css,
      );
    expect(filled, 'one rule for the filled and framed variants').not.toBeNull();
    expect(filled![1]).toMatch(/background:\s*var\(--surface-sunken\)/);
    expect(filled![1]).toMatch(/(?:^|[\s;])color:\s*var\(--text-3\)/);
    // A quiet edge keeps the outline: the control frame, weakened, never the accent.
    expect(filled![1]).toMatch(
      /border-color:\s*color-mix\(in srgb, var\(--border-strong\) \d+%, transparent\)/,
    );
    const quiet = /\.ghost:disabled,\s*\.quietDanger:disabled\s*\{([^}]*)\}/.exec(css);
    expect(quiet![1]).toMatch(/(?:^|[\s;])color:\s*var\(--text-3\)/);
    // No rule that matches a disabled button brings the accent or the danger tone back.
    for (const m of css.matchAll(/([^{}]*:disabled[^{}]*)\{([^}]*)\}/g)) {
      if (/:not\(:disabled\)/.test(m[1]!)) continue;
      expect(m[2], m[1]!.trim()).not.toMatch(/--accent|--danger/);
    }
    // The state wins over every variant: its rules are the last ones of the file.
    expect(css.lastIndexOf('.primary {')).toBeLessThan(css.indexOf('.primary:disabled'));
    expect(css.lastIndexOf('.icon.ghost {')).toBeLessThan(css.indexOf('.primary:disabled'));
  });

  it('no stylesheet of ui/ fades a disabled control: no opacity on :disabled, [disabled] or [data-disabled]', () => {
    const files = (readdirSync(__dirname, { recursive: true }) as string[])
      .map((f) => f.split('\\').join('/'))
      .filter((f) => f.endsWith('.module.css'));
    expect(files.length).toBeGreaterThan(30);
    const hits: string[] = [];
    for (const file of files)
      for (const m of sheet(file).matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        const selectors = m[1]!.split(',').filter(
          // `:not(:disabled)` and `:not([data-disabled…])` describe the enabled control.
          (sel) =>
            /:disabled|\[disabled|\[data-disabled|\[aria-disabled/.test(
              sel.replace(/:not\([^)]*\)/g, ''),
            ),
        );
        if (selectors.length && /(?:^|[\s;])opacity\s*:/.test(m[2]!))
          hits.push(`${file}: ${selectors.join(',').trim()}`);
      }
    expect(hits).toEqual([]);
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
