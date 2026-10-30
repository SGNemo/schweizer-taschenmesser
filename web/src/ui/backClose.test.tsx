// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { backDepth, resetBackStack } from '@/core/shell/backStack';
import { Dialog } from './Dialog';
import { RowMenu } from './RowMenu';

const back = async () => {
  await act(async () => {
    history.back();
    await new Promise((r) => setTimeout(r, 20));
  });
};

afterEach(() => {
  resetBackStack();
  history.replaceState(null, '', '/');
});

function Host({ dirty = false }: { dirty?: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <span>{open ? 'offen' : 'zu'}</span>
      <Dialog open={open} onClose={() => setOpen(false)} title="T" dirty={dirty}>
        <p>Inhalt</p>
      </Dialog>
    </>
  );
}

describe('Back closes what is open', () => {
  it('a dialog', async () => {
    render(<Host />);
    expect(screen.getByText('offen')).toBeTruthy();
    await back();
    expect(screen.getByText('zu')).toBeTruthy();
  });

  it('a dialog with a draft asks first; Back at the question keeps editing', async () => {
    render(<Host dirty />);
    await back();
    expect(screen.getByText('offen')).toBeTruthy();
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    await back();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByText('offen')).toBeTruthy();
    // The entry was put back: one more Back asks again.
    await back();
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });

  it('a dialog whose parent handles Back adds no entry of its own', () => {
    render(
      <Dialog open onClose={() => undefined} title="T" backHandled>
        <p>Inhalt</p>
      </Dialog>,
    );
    expect(backDepth()).toBe(0);
  });

  it('a row menu, and the dialog under it stays', async () => {
    function Both() {
      const [menu, setMenu] = useState(false);
      return (
        <Dialog open onClose={() => undefined} title="T">
          <RowMenu label="Zeile" items={[]} open={menu} onOpenChange={setMenu} />
          <button type="button" onClick={() => setMenu(true)}>
            auf
          </button>
        </Dialog>
      );
    }
    render(<Both />);
    await act(async () => screen.getByText('auf').click());
    expect(screen.getByRole('menu')).toBeTruthy();
    await back();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('askAfterTyping', () => {
  function Editor() {
    const [open, setOpen] = useState(true);
    return (
      <>
        <span>{open ? 'offen' : 'zu'}</span>
        <Dialog open={open} onClose={() => setOpen(false)} title="T" askAfterTyping>
          <input aria-label="Feld" />
        </Dialog>
      </>
    );
  }

  it('an empty editor closes at once on Back', async () => {
    render(<Editor />);
    await back();
    expect(screen.getByText('zu')).toBeTruthy();
  });

  it('after typing, Back asks first', async () => {
    render(<Editor />);
    fireEvent.input(screen.getByLabelText('Feld'), { target: { value: 'x' } });
    await back();
    expect(screen.getByText('offen')).toBeTruthy();
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });
});
