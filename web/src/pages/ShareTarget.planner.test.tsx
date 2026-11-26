// @vitest-environment jsdom
/**
 * Shared into the planner (planner hub 2, package 1; hand-off 01 „Tests“, LAUNCH-REVIEW B9): with the planner on the form
 * starts with the kind `plan`; nothing is written before „Speichern“; every stored field is shown on the page (the title
 * in the form, the address as S16, the rest behind the tick); the address only for http/https ≤ 2 048 and only under
 * `plan`; S8 → „Rückgängig“ → S14, also through the capture toast; another kind keeps the built way (toast, home).
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll } from '@/core/ai/testing';
import { db } from '@/core/db/db';
import { enableModule } from '@/core/modules/activation';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { trimTrailing } from '@/core/net/webAddress';
import { SHARE_NOTE_MAX, ShareTarget, screenLine, shareNote } from './ShareTarget';

vi.setConfig({ testTimeout: 20_000 });

const URL_ = 'https://example.org/fahrradtraeger';
const shareUrl = (v: Record<string, string>) => `/share?${new URLSearchParams(v).toString()}`;

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 30, 10, 0).getTime());
  localStorage.clear();
  await clearAll();
  useUiStore.setState({ toasts: [] });
  for (const id of ['todos', 'planner']) await enableModule(getManifest(id)!);
});
afterEach(() => setNow());

function open(v: Record<string, string>) {
  return render(
    <MemoryRouter initialEntries={[shareUrl(v)]}>
      <Routes>
        <Route path="/share" element={<ShareTarget />} />
        <Route path="/" element={<p>Startseite</p>} />
        <Route path="/planner" element={<p>Planer-Seite</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
const tasks = async () =>
  (await db.table('todos_task').toArray()) as { id: string; title: string; note?: string }[];
const lines = () => screen.queryByTestId('share-plan-lines');
const pickKind = async (name: string) =>
  userEvent.setup().click(await screen.findByRole('radio', { name }));

describe('shareNote', () => {
  it('under `plan` the address leads (also without the tick), the rest is cut to fit; any other kind as built', () => {
    expect(shareNote('plan', URL_, 'Rest', false)).toEqual({ note: URL_, cut: false });
    expect(shareNote('plan', URL_, 'Rest', true)).toEqual({ note: `${URL_}\nRest`, cut: false });
    const long = 'x'.repeat(5000);
    const r = shareNote('plan', URL_, long, true);
    expect(r.cut).toBe(true);
    expect(r.note!.length).toBe(SHARE_NOTE_MAX);
    expect(shareNote('todo', URL_, 'Rest', true)).toEqual({ note: 'Rest', cut: false });
    expect(shareNote('note', URL_, 'Rest', false)).toEqual({ cut: false });
  });
});

describe('ShareTarget with the planner on', () => {
  it('starts with the kind `plan`, says S2 and S16, writes nothing before „Speichern“', async () => {
    open({ title: 'Fahrradträger', text: URL_ });
    await waitFor(() => expect(lines()).toHaveTextContent(t.planner.share.lands));
    expect(lines()).toHaveTextContent(t.planner.share.linkSaved('example.org'));
    expect(screen.getByRole('radio', { checked: true })).toBeInTheDocument();
    // Never the vault.
    expect(screen.queryByRole('radio', { name: /Konten|Passw/ })).toBeNull();
    expect(await db.table('todos_task').count()).toBe(0);
    expect(await db.table('planner_item').count()).toBe(0);
  });

  it('every stored field is on the page: title in the form, address as S16, the ticked rest in „Geteilt“', async () => {
    const user = userEvent.setup();
    open({ title: 'Fahrradträger', text: `${URL_}\nPasst auf die Kupplung.\nGrüße` });
    await waitFor(() => expect(lines()).toHaveTextContent('example.org'));
    await user.click(screen.getByRole('checkbox', { name: t.quickCapture.share.asNote }));
    await user.click(screen.getByRole('button', { name: t.quickCapture.save }));
    await waitFor(async () => expect(await tasks()).toHaveLength(1));
    const [task] = await tasks();
    expect(task!.title).toBe('Fahrradträger');
    const shared = screen.getByTestId('shared-content').textContent ?? '';
    // The note's every line was on the page before: the address (S16, „Geteilt“) and the rest („Geteilt“).
    for (const l of task!.note!.split('\n')) expect(shared).toContain(l);
    expect(task!.note!.split('\n')[0]).toBe(URL_);
    expect(await db.table('planner_item').get(`todos:${task!.id}`)).toBeTruthy();
  });

  it('an address without http/https or over 2 048 characters: S19, nothing of it stored', async () => {
    const user = userEvent.setup();
    const { unmount } = open({ title: 'Seite', url: 'www.example.org/x' });
    await waitFor(() => expect(lines()).toHaveTextContent(t.planner.share.linkNotSaved));
    expect(screen.getByTestId('shared-content')).toHaveTextContent('www.example.org/x');
    await user.click(screen.getByRole('button', { name: t.quickCapture.save }));
    await waitFor(async () => expect(await tasks()).toHaveLength(1));
    expect((await tasks())[0]!.note ?? '').toBe('');
    unmount();
    await db.table('todos_task').clear();
    open({ title: 'Lang', url: `https://example.org/${'a'.repeat(2100)}` });
    await waitFor(() => expect(lines()).toHaveTextContent(t.planner.share.linkNotSaved));
  });

  it('another kind (Notiz, ToDo): S2 and S16 go, the note is exactly the ticked rest', async () => {
    const user = userEvent.setup();
    // The address beside the text (a text that holds it keeps it in its rest, as built).
    open({ title: 'Fahrradträger', url: URL_, text: 'Passt auf die Kupplung.\nGrüße' });
    await waitFor(() => expect(lines()).not.toBeNull());
    await pickKind(t.quickCapture.type.todo);
    await waitFor(() => expect(lines()).toBeNull());
    await user.click(screen.getByRole('checkbox', { name: t.quickCapture.share.asNote }));
    await user.click(screen.getByRole('button', { name: t.quickCapture.save }));
    await waitFor(async () => expect(await tasks()).toHaveLength(1));
    const [task] = await tasks();
    expect(task!.note).not.toContain(URL_);
    expect(task!.note).toContain('Passt auf die Kupplung.');
    // The built way: the capture toast, then home.
    expect(await screen.findByText('Startseite')).toBeInTheDocument();
    expect(screen.queryByTestId('share-saved')).toBeNull();
  });

  it('a Notiz keeps the built note too', async () => {
    const user = userEvent.setup();
    await enableModule(getManifest('notes')!);
    open({ title: 'Fahrradträger', text: `${URL_}\nPasst auf die Kupplung.` });
    await waitFor(() => expect(lines()).not.toBeNull());
    // „Notiz“ stands behind „Mehr (n)“.
    const more = screen.queryByTestId('capture-more-types');
    if (more) await user.click(more);
    await pickKind(t.quickCapture.type.note);
    await waitFor(() => expect(lines()).toBeNull());
    await user.click(screen.getByRole('button', { name: t.quickCapture.save }));
    expect(await screen.findByText('Startseite')).toBeInTheDocument();
  });

  it('stored as `plan`: S8 with „Ansehen“; „Rückgängig“ turns the page to S14 without „Ansehen“', async () => {
    const user = userEvent.setup();
    open({ title: 'Fahrradträger', text: URL_ });
    await waitFor(() => expect(lines()).not.toBeNull());
    await user.click(screen.getByRole('button', { name: t.quickCapture.save }));
    const status = await screen.findByTestId('share-saved');
    expect(status).toHaveTextContent(t.planner.share.saved);
    const [task] = await tasks();
    const card = status.parentElement!;
    expect(await within(card).findByRole('link', { name: t.planner.share.view })).toHaveAttribute(
      'href',
      `/planner?item=${encodeURIComponent(`todos:${task!.id}`)}`,
    );
    await user.click(within(card).getByRole('button', { name: t.ui.undo }));
    await waitFor(() => expect(status).toHaveTextContent(t.planner.share.undone));
    expect(within(card).queryByRole('link', { name: t.planner.share.view })).toBeNull();
    expect(
      await db
        .table('todos_task')
        .filter((r) => r.deletedAt === null)
        .count(),
    ).toBe(0);
    await user.click(within(card).getByRole('button', { name: t.planner.share.done }));
    expect(await screen.findByText('Planer-Seite')).toBeInTheDocument();
  });

  it("the capture toast's „Rückgängig“ turns the page to S14 as well", async () => {
    const user = userEvent.setup();
    open({ title: 'Fahrradträger', text: URL_ });
    await waitFor(() => expect(lines()).not.toBeNull());
    await user.click(screen.getByRole('button', { name: t.quickCapture.save }));
    const status = await screen.findByTestId('share-saved');
    await waitFor(() => expect(useUiStore.getState().toasts.at(-1)?.action).toBeTruthy());
    useUiStore.getState().toasts.at(-1)!.action!.run();
    await waitFor(() => expect(status).toHaveTextContent(t.planner.share.undone));
  });
});

describe('ShareTarget with the planner off', () => {
  it('the page as today: no S2, no stored state', async () => {
    await db.table('_modules').delete('planner');
    open({ title: 'Fahrradträger', text: URL_ });
    await screen.findByRole('textbox', { name: t.quickCapture.inputLabel });
    await new Promise((r) => setTimeout(r, 50));
    expect(lines()).toBeNull();
  });
});

describe('council round 1', () => {
  it('an address that is not stored never reaches the title either (javascript:, intent:, file:)', async () => {
    const user = userEvent.setup();
    for (const bad of ['javascript:alert(1)', 'intent://scan#Intent;end', 'file:///etc/hosts']) {
      const { unmount } = open({ title: 'Seite', url: bad });
      await waitFor(() => expect(lines()).toHaveTextContent(t.planner.share.linkNotSaved));
      expect(screen.getByTestId('shared-content')).toHaveTextContent(bad);
      await user.click(screen.getByRole('button', { name: t.quickCapture.save }));
      await waitFor(async () => expect(await tasks()).toHaveLength(1));
      const [task] = await tasks();
      expect(task!.title).toBe('Seite');
      expect(task!.note ?? '').toBe('');
      unmount();
      await db.table('todos_task').clear();
      await db.table('planner_item').clear();
    }
  });

  it("focus: on „Fertig“ after „Speichern“, on the page head after this page's „Rückgängig“", async () => {
    const user = userEvent.setup();
    open({ title: 'Fahrradträger', text: URL_ });
    await waitFor(() => expect(lines()).not.toBeNull());
    await user.click(screen.getByRole('button', { name: t.quickCapture.save }));
    const done = await screen.findByRole('button', { name: t.planner.share.done });
    await waitFor(() => expect(done).toHaveFocus());
    // One live region for the visit, filled after „Speichern“.
    expect(screen.getByRole('status')).toHaveTextContent(t.planner.share.saved);
    await user.click(screen.getByRole('button', { name: t.ui.undo }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus());
    expect(screen.getByRole('status')).toHaveTextContent(t.planner.share.undone);
    // The capture toast's „Rückgängig“ goes with it; the other ways to save are gone since „Speichern“.
    await waitFor(() =>
      expect(
        useUiStore.getState().toasts.some((x) => x.action?.label === t.quickCapture.undo),
      ).toBe(false),
    );
    expect(screen.queryByText(t.quickCapture.share.or)).toBeNull();
  });

  it('shareNote: a rest that starts with the address stores it once; the cut never splits a character', () => {
    expect(shareNote('plan', URL_, `${URL_}\nRest`, true).note).toBe(`${URL_}\nRest`);
    const emoji = `${'x'.repeat(SHARE_NOTE_MAX - URL_.length - 2)}😀😀`;
    const r = shareNote('plan', URL_, emoji, true);
    expect(r.cut).toBe(true);
    expect(/[\ud800-\udbff]$/.test(r.note!)).toBe(false);
  });
});

describe('council round 2', () => {
  it('an address inside the text that is not stored never becomes the title (Android path)', async () => {
    const user = userEvent.setup();
    for (const bad of [
      `https://example.org/${'a'.repeat(2100)}`,
      'https://good.example@evil.example/x',
    ]) {
      const { unmount } = open({ text: bad });
      await waitFor(() => expect(lines()).toHaveTextContent(t.planner.share.linkNotSaved));
      const box = await screen.findByRole('textbox', { name: t.quickCapture.inputLabel });
      await user.type(box, 'Seite merken');
      await user.click(screen.getByRole('button', { name: t.quickCapture.save }));
      await waitFor(async () => expect(await tasks()).toHaveLength(1));
      const [task] = await tasks();
      expect(task!.title).toBe('Seite merken');
      expect(task!.note ?? '').not.toContain('example');
      unmount();
      await db.table('todos_task').clear();
      await db.table('planner_item').clear();
    }
  });

  it('a rest that starts with the same address as URL reads it stores it once (bare origin, trailing dot)', () => {
    expect(shareNote('plan', 'https://example.com/', 'https://example.com\nRest', true).note).toBe(
      'https://example.com/\nRest',
    );
    expect(
      shareNote('plan', 'https://example.com/a', 'https://example.com/a.\nRest', true).note,
    ).toBe('https://example.com/a\nRest');
  });

  it('a ticked rest led by another address is named on the page (S16) before „Speichern“', async () => {
    const user = userEvent.setup();
    open({ title: 'Seite', url: 'www.example.org/x', text: 'https://other.example/a\nmehr' });
    await waitFor(() => expect(lines()).toHaveTextContent(t.planner.share.linkNotSaved));
    expect(lines()).not.toHaveTextContent('other.example');
    await user.click(screen.getByRole('checkbox', { name: t.quickCapture.share.asNote }));
    await waitFor(() =>
      expect(lines()).toHaveTextContent(t.planner.share.linkSaved('other.example')),
    );
  });
});

describe('council round 3', () => {
  it('the line keeps no address the gate rejects: upper-case scheme, www., a second address, its punctuation', () => {
    expect(screenLine('Schau: https://good@evil.example/x.')).toBe('Schau:');
    expect(screenLine('HTTPS://good@evil.example/x')).toBe('');
    expect(screenLine(`Seite www.${'a'.repeat(30)}.example`)).toBe('Seite');
    expect(screenLine('Schau https://ok.example/a https://good@evil.example/x')).toBe(
      'Schau https://ok.example/a',
    );
  });

  it('an upper-case address in the text is named S19 and never stored', async () => {
    const user = userEvent.setup();
    open({ text: 'Merken HTTPS://good@evil.example/x' });
    await waitFor(() => expect(lines()).toHaveTextContent(t.planner.share.linkNotSaved));
    await user.click(screen.getByRole('button', { name: t.quickCapture.save }));
    await waitFor(async () => expect(await tasks()).toHaveLength(1));
    const [task] = await tasks();
    expect(task!.title).toBe('Merken');
    expect(task!.note ?? '').toBe('');
  });
});

describe('council round 4', () => {
  it('screens tokens exactly as the parser cuts them (at " \' < >)', () => {
    expect(screenLine('Schau https://ok.com/"https://user@evil.com/x')).toBe(
      'Schau https://ok.com/"',
    );
    expect(screenLine("Schau https://ok.com/'HTTPS://a@b.example/")).toBe("Schau https://ok.com/'");
    expect(screenLine('Schau https://ok.com/<www.evil.com>')).not.toMatch(/evil/);
  });

  it('stays fast on a crafted 20 000-character share', () => {
    const started = performance.now();
    screenLine(`https://a.example/${')'.repeat(20_000)}`);
    screenLine(`https://a.example/${').'.repeat(10_000)}`);
    screenLine(`x ${'.'.repeat(20_000)}y`);
    trimTrailing(`https://a.example/${')'.repeat(20_000)}`);
    expect(performance.now() - started).toBeLessThan(500);
  });
});
