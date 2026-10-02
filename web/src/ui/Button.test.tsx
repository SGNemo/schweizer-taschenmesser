// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button, IconButton } from './Button';
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
