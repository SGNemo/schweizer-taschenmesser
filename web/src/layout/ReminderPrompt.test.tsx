// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { isAcked } from '@/core/notifications/ack';
import { useReminderPrompts } from '@/core/notifications/inapp';
import { getSnoozed } from '@/core/notifications/snooze';
import { setNow } from '@/core/time/now';
import { ReminderPrompt } from './ReminderPrompt';

const NOW = new Date(2026, 9, 2, 10, 0).getTime();
const draw = () =>
  render(
    <MemoryRouter>
      <ReminderPrompt />
    </MemoryRouter>,
  );

beforeEach(async () => {
  setNow(() => NOW);
  useReminderPrompts.setState({ items: [] });
  await db.table('_settings').clear();
  await db.table('_meta').clear();
});
afterEach(() => {
  cleanup();
  setNow();
});

describe('ReminderPrompt', () => {
  it('renders nothing without a reminder', () => {
    const { container } = draw();
    expect(container.firstChild).toBeNull();
  });

  it('"Erledigt" closes the card, remembers the answer and shows the next one', async () => {
    useReminderPrompts.getState().push({ key: 'event:1:x', title: 'Paket abholen', body: '17:30' });
    useReminderPrompts.getState().push({ key: 'event:2:y', title: 'Müll rausbringen' });
    draw();
    expect(await screen.findByText('Paket abholen')).toBeInTheDocument();
    expect(screen.getByText('+ 1 weitere')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Erledigt' }));
    expect(await screen.findByText('Müll rausbringen')).toBeInTheDocument();
    expect(await isAcked('event:1:x')).toBe(true);
  });

  it('a follow-up answered with "Erledigt" also acknowledges the original reminder', async () => {
    useReminderPrompts.getState().push({ key: 'event:1:x:f', title: 'Noch aktuell? Paket' });
    draw();
    fireEvent.click(await screen.findByRole('button', { name: 'Erledigt' }));
    await waitFor(async () => expect(await isAcked('event:1:x')).toBe(true));
  });

  it('"Später" offers sensible options and stores the choice', async () => {
    useReminderPrompts
      .getState()
      .push({ key: 'event:1:x', title: 'Paket abholen', url: '/calendar' });
    draw();
    fireEvent.click(await screen.findByRole('button', { name: 'Später' }));
    const list = screen.getByRole('list', { name: 'Später' });
    expect(list.textContent).toContain('In 10 Min');
    expect(list.textContent).toContain('Heute Abend');
    expect(list.textContent).toContain('Wenn ich am PC bin');
    fireEvent.click(screen.getByRole('button', { name: 'In 1 Std' }));
    await waitFor(async () => expect(await getSnoozed()).toHaveLength(1));
    expect((await getSnoozed())[0]).toMatchObject({
      title: 'Paket abholen',
      until: NOW + 3_600_000,
    });
    expect(useReminderPrompts.getState().items).toEqual([]);
  });
});
