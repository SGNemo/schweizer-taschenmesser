// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll } from '@/core/ai/testing';
import { db } from '@/core/db/db';
import { patchFocusSettings } from '@/core/settings/focus';
import { setNow } from '@/core/time/now';
import { t } from '@/strings';
import { CaptureForm } from './CaptureForm';

// Wednesday, 2026-09-30, 10:00. Todos, calendar and finance are on by default.
beforeEach(async () => {
  setNow(() => new Date(2026, 8, 30, 10, 0).getTime());
  await clearAll();
});
afterEach(() => setNow());

const box = () => screen.findByRole('textbox', { name: t.quickCapture.inputLabel });
const chips = () => screen.getByTestId('capture-chips');

describe('CaptureForm', () => {
  it('shows a live preview and saves an appointment with Enter', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} />);
    await user.type(await box(), 'morgen 15 Uhr Zahnarzt');
    await waitFor(() => expect(chips()).toHaveTextContent('Ziel: Kalender'));
    expect(chips()).toHaveTextContent('Morgen, 1. Okt');
    expect(chips()).toHaveTextContent('15:00 Uhr');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [event] = await db.table('calendar_event').toArray();
    expect(event).toMatchObject({ title: 'Zahnarzt', startDate: '2026-10-01', startTime: '15:00' });
  });

  it('lets ArrowDown switch the type before saving', async () => {
    const user = userEvent.setup();
    render(<CaptureForm onSaved={() => undefined} />);
    await user.type(await box(), 'Blumen gießen');
    await waitFor(() => expect(chips()).toHaveTextContent('Ziel: ToDos'));
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(chips()).toHaveTextContent('Ziel: Kalender'));
    await user.keyboard('{Enter}');
    await waitFor(async () => expect(await db.table('calendar_event').count()).toBe(1));
    expect(await db.table('todos_task').count()).toBe(0);
  });

  it('asks instead of guessing on a low-confidence input when "Ohne Rückfrage" is off, and does not save', async () => {
    await patchFocusSettings({ captureNoQuestion: false });
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} />);
    await user.type(await box(), 'Zahnarzt morgen 15 Uhr 80 €');
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(t.quickCapture.chooseType);
    expect(onSaved).not.toHaveBeenCalled();
    await user.click(screen.getByRole('radio', { name: t.quickCapture.type.event }));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('books finance only after an explicit confirmation', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} />);
    await user.type(await box(), '$ 12,50 Mittagessen{Enter}');
    expect(await screen.findByTestId('capture-draft')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(await db.table('finance_transaction').count()).toBe(0);
    await user.click(screen.getByRole('button', { name: t.quickCapture.book }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [tx] = await db.table('finance_transaction').toArray();
    expect(tx).toMatchObject({ amountMinor: 1250, kind: 'expense', payee: 'Mittagessen' });
  });

  it('closes with Escape', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<CaptureForm onSaved={() => undefined} onCancel={onCancel} />);
    await user.type(await box(), 'x{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });

  it('Tab switches the type in the capture window', async () => {
    const user = userEvent.setup();
    render(<CaptureForm tabSwitchesType onSaved={() => undefined} />);
    await user.type(await box(), 'Blumen gießen');
    await waitFor(() => expect(chips()).toHaveTextContent('Ziel: ToDos'));
    await user.tab();
    await waitFor(() => expect(chips()).toHaveTextContent('Ziel: Kalender'));
    expect(await box()).toHaveFocus();
  });

  it('flags assumptions instead of hiding them', async () => {
    const user = userEvent.setup();
    render(<CaptureForm onSaved={() => undefined} />);
    await user.type(await box(), '15 Uhr Zahnarzt');
    await waitFor(() => expect(chips()).toHaveTextContent(t.quickCapture.chip.assumedDate));
  });

  it('without the question: unclear text is saved as typed in the ToDo inbox', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} />);
    await user.type(await box(), 'Zahnarzt morgen 15 Uhr 80 €');
    expect(await screen.findByTestId('capture-inbox-hint')).toHaveTextContent('Landet in „ToDos“');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [task] = await db.table('todos_task').toArray();
    expect(task).toMatchObject({ title: 'Zahnarzt morgen 15 Uhr 80 €', listId: 'inbox' });
    expect(await db.table('calendar_event').count()).toBe(0);
    expect(await db.table('finance_transaction').count()).toBe(0);
  });

  it('Ctrl+Enter opens the full form pre-filled instead of saving', async () => {
    const user = userEvent.setup();
    const onOpenFull = vi.fn();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} onOpenFull={onOpenFull} />);
    await user.type(await box(), 'Blumen gießen');
    await waitFor(() => expect(chips()).toHaveTextContent('Ziel: ToDos'));
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(onOpenFull).toHaveBeenCalledWith('/todos?new=1&title=Blumen%20gie%C3%9Fen');
    expect(onSaved).not.toHaveBeenCalled();
    expect(await db.table('todos_task').count()).toBe(0);
  });

  it('Ctrl+Enter just saves where no full form can be pre-filled', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<CaptureForm onSaved={onSaved} onOpenFull={() => undefined} />);
    await user.type(await box(), 'morgen 15 Uhr Zahnarzt');
    await waitFor(() => expect(chips()).toHaveTextContent('Ziel: Kalender'));
    await user.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
});
