// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { SplitView } from './Patterns';

afterEach(cleanup);

/** A list with one row: clicking it opens the panel, the panel's button closes it again. */
function Page() {
  const [open, setOpen] = useState(false);
  return (
    <SplitView
      enabled={open}
      asideLabel="Detail"
      aside={
        <button type="button" onClick={() => setOpen(false)}>
          close
        </button>
      }
    >
      <button type="button" onClick={() => setOpen(true)}>
        row
      </button>
    </SplitView>
  );
}

describe('SplitView focus (0b-8)', () => {
  it('the row that opens the panel keeps its element and the focus', () => {
    render(<Page />);
    const row = screen.getByRole('button', { name: 'row' });
    row.focus();
    act(() => row.click());
    expect(screen.getByRole('complementary', { name: 'Detail' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'row' })).toBe(row);
    expect(document.activeElement).toBe(row);
  });

  it('closing the panel from inside it puts the focus back on the row', () => {
    render(<Page />);
    const row = screen.getByRole('button', { name: 'row' });
    row.focus();
    act(() => row.click());
    const close = screen.getByRole('button', { name: 'close' });
    close.focus();
    act(() => close.click());
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(document.activeElement).toBe(row);
  });

  it('when the row is gone (deleted from the panel), the focus goes to the first control of the list', () => {
    function Deleting() {
      const [rows, setRows] = useState(['a', 'b']);
      const [open, setOpen] = useState<string | undefined>();
      return (
        <SplitView
          enabled={open !== undefined}
          asideLabel="Detail"
          aside={
            <button
              type="button"
              onClick={() => {
                setRows((r) => r.filter((x) => x !== open));
                setOpen(undefined);
              }}
            >
              delete
            </button>
          }
        >
          {rows.map((r) => (
            <button key={r} type="button" onClick={() => setOpen(r)}>
              row {r}
            </button>
          ))}
        </SplitView>
      );
    }
    render(<Deleting />);
    const b = screen.getByRole('button', { name: 'row b' });
    b.focus();
    act(() => b.click());
    const del = screen.getByRole('button', { name: 'delete' });
    del.focus();
    act(() => del.click());
    expect(screen.queryByRole('button', { name: 'row b' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'row a' }));
  });

  it('a focus outside the panel is left alone when it closes', () => {
    render(
      <>
        <input aria-label="search" />
        <Page />
      </>,
    );
    const row = screen.getByRole('button', { name: 'row' });
    act(() => row.click());
    const close = screen.getByRole('button', { name: 'close' });
    close.focus();
    const search = screen.getByRole('textbox', { name: 'search' });
    search.focus();
    act(() => close.click());
    expect(document.activeElement).toBe(search);
  });
});
