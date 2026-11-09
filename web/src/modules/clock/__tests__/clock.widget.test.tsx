// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { WidgetSizeContext, type WidgetSizeName } from '@/ui';
import { addPlace } from '../repo';
import ClockWidget from '../widgets/ClockWidget';

const view = (size: WidgetSizeName = 'm') =>
  render(
    <MemoryRouter>
      <WidgetSizeContext.Provider value={size}>
        <ClockWidget />
      </WidgetSizeContext.Provider>
    </MemoryRouter>,
  );

describe('clock widget', () => {
  beforeEach(async () => {
    await db.table('clock_place').clear();
    setNow(() => Date.parse('2026-01-15T21:30:00Z'));
  });
  afterEach(() => setNow());

  it('shows an empty state with an action when there is no place', async () => {
    view();
    expect(await screen.findByRole('link', { name: /Ort hinzufügen/ })).toHaveAttribute(
      'href',
      '/clock?new=1',
    );
  });

  it('shows the time, the name and day or night in words with the offset', async () => {
    await addPlace('Büro Tokio', 'Asia/Tokyo');
    view();
    expect(await screen.findByText('Büro Tokio')).toBeInTheDocument();
    // The context line never relies on colour: "Tag"/"Nacht" and the offset as text.
    expect(screen.getByText(/^(Tag|Nacht) · /)).toBeInTheDocument();
  });

  it('shows two places at size s, four at m', async () => {
    for (const [i, zone] of [
      'Asia/Tokyo',
      'UTC',
      'Europe/Lisbon',
      'Asia/Dubai',
      'Asia/Seoul',
    ].entries())
      await addPlace(`Ort ${i + 1}`, zone);
    const { unmount } = view('s');
    expect(await screen.findByText('Ort 2')).toBeInTheDocument();
    expect(screen.queryByText('Ort 3')).toBeNull();
    unmount();
    view('m');
    expect(await screen.findByText('Ort 4')).toBeInTheDocument();
    expect(screen.queryByText('Ort 5')).toBeNull();
  });
});
