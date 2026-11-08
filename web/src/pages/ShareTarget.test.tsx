// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll } from '@/core/ai/testing';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { t } from '@/strings';
import { ShareTarget, sharedContent, sharedLine } from './ShareTarget';

vi.setConfig({ testTimeout: 20_000 });

beforeEach(async () => {
  setNow(() => new Date(2026, 8, 30, 10, 0).getTime());
  localStorage.clear();
  await clearAll();
});
afterEach(() => setNow());

// A mail shared from a phone's mail app: subject as title, the body with its own line breaks. Invented.
const MAIL = {
  title: 'Heizung im Bad',
  text: 'Hallo,\nkönnen Sie mir bis Freitag antworten?\nDie Heizung im Bad bleibt kalt.\nGrüße',
};
const shareUrl = (v: Record<string, string>) => `/share?${new URLSearchParams(v).toString()}`;

describe('sharedLine (U17)', () => {
  it('takes the first non-empty line; the rest is only offered as a note', () => {
    const c = sharedContent(new URLSearchParams(MAIL));
    expect(sharedLine(c)).toEqual({
      line: 'Heizung im Bad',
      rest: 'Hallo,\nkönnen Sie mir bis Freitag antworten?\nDie Heizung im Bad bleibt kalt.\nGrüße',
    });
  });

  it('keeps a link shared on its own on the line (a page stays a bookmark)', () => {
    const c = sharedContent(new URLSearchParams({ title: 'Rezept', url: 'https://example.org/r' }));
    expect(sharedLine(c)).toEqual({ line: 'Rezept https://example.org/r', rest: '' });
  });

  it('keeps the link of a one-line text on the line, but not the links of a long text', () => {
    const short = { title: 'Schöner Weg', text: 'Schau mal https://wandern.example/weg' };
    expect(sharedLine(sharedContent(new URLSearchParams(short))).line).toBe(
      'Schöner Weg https://wandern.example/weg',
    );
    const long = { title: 'Termin', text: 'Hallo,\nhier der Link: https://example.org/t\nGrüße' };
    expect(sharedLine(sharedContent(new URLSearchParams(long))).line).toBe('Termin');
  });
});

describe('sharedLine – edge cases', () => {
  const line = (v: Record<string, string>) => sharedLine(sharedContent(new URLSearchParams(v)));
  it('blank-led text, kept paragraph breaks, a repeated title, no title', () => {
    expect(line({ text: '\n\nHallo\nzweite' })).toEqual({ line: 'Hallo', rest: 'zweite' });
    expect(line({ title: 'T', text: 'a\n\nb' }).rest).toBe('a\n\nb');
    expect(line({ title: 'T', text: 'T\nRest' })).toEqual({ line: 'T', rest: 'Rest' });
    expect(line({ text: 'Nur eine Zeile' })).toEqual({ line: 'Nur eine Zeile', rest: '' });
  });
});

describe('ShareTarget', () => {
  const open = () =>
    render(
      <MemoryRouter initialEntries={[shareUrl(MAIL)]}>
        <ShareTarget />
      </MemoryRouter>,
    );

  it('a shared mail with line breaks becomes one ToDo with an empty note', async () => {
    const user = userEvent.setup();
    open();
    const box = await screen.findByRole('textbox', { name: t.quickCapture.inputLabel });
    expect(box).toHaveValue('Heizung im Bad');
    expect(screen.queryByTestId('capture-rows')).toBeNull();
    expect(screen.getByRole('checkbox', { name: t.quickCapture.share.asNote })).not.toBeChecked();
    await user.click(await screen.findByRole('radio', { name: t.quickCapture.type.todo }));
    await user.click(screen.getByRole('button', { name: t.quickCapture.save }));
    await waitFor(async () => expect(await db.table('todos_task').count()).toBe(1));
    const [task] = await db.table('todos_task').toArray();
    expect(task.title).toBe('Heizung im Bad');
    expect(task.note ?? '').toBe('');
  });

  it('with „Text als Notiz“ ticked the rest of the text becomes the note', async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole('checkbox', { name: t.quickCapture.share.asNote }));
    await user.click(await screen.findByRole('radio', { name: t.quickCapture.type.todo }));
    await user.click(screen.getByRole('button', { name: t.quickCapture.save }));
    await waitFor(async () => expect(await db.table('todos_task').count()).toBe(1));
    const [task] = await db.table('todos_task').toArray();
    expect(task.note).toContain('Die Heizung im Bad bleibt kalt.');
  });
});
