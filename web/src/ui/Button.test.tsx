// @vitest-environment jsdom
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
