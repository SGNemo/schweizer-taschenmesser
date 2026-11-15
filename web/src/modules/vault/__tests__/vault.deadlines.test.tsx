// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blobKeys, putBlob } from '@/core/blobs';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { undoLast } from '@/core/undo';
import { FilePreview, canPreview } from '../components/FilePreview';
import { documentRepo } from '../repo';
import VaultPage from '../routes/VaultPage';

const page = () =>
  render(
    <MemoryRouter>
      <VaultPage />
    </MemoryRouter>,
  );

/** The page at an address, with the address as it is now written beside it. */
function Where() {
  const { search } = useLocation();
  return <output data-testid="search">{search}</output>;
}
const pageAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <VaultPage />
      <Where />
    </MemoryRouter>,
  );

/** Holds every `documentRepo.update` until `release()`; `landed` says when to let the write itself through. */
function holdWrites(landed: 'before' | 'after') {
  const original = documentRepo.update.bind(documentRepo);
  let open!: () => void;
  const gate = new Promise<void>((resolve) => (open = resolve));
  const spy = vi.spyOn(documentRepo, 'update').mockImplementation(async (...args) => {
    if (landed === 'after') {
      await gate;
      return original(...args);
    }
    const result = await original(...args);
    await gate;
    return result;
  });
  return { spy, release: () => open() };
}

beforeEach(async () => {
  setNow(() => new Date(2026, 8, 29, 10, 0).getTime());
  await db.table('vault_document').clear();
  await db.table('_blobs').clear();
});
afterEach(() => setNow());

async function seed() {
  await documentRepo.create({ title: 'Mietvertrag', category: 'contract' } as never);
  await documentRepo.create({
    title: 'Impfpass',
    category: 'health',
    endDate: '2026-09-20',
  } as never);
  await documentRepo.create({
    title: 'Hausrat',
    category: 'insurance',
    startDate: '2025-10-01',
    endDate: '2026-09-25',
  } as never);
  await documentRepo.create({
    title: 'Reisepass',
    category: 'identity',
    endDate: '2026-11-06',
  } as never);
}

describe('Unterlagen: view "Fristen"', () => {
  it('the views carry no counts; the rail shows dated documents around "Heute", expired ones in the warning tone', async () => {
    await seed();
    page();
    const views = await screen.findByRole('navigation', { name: 'Ansichten' });
    expect(
      within(views)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Ablage', 'Fristen']);
    fireEvent.click(within(views).getByRole('button', { name: 'Fristen' }));
    const rail = await screen.findByRole('list', { name: 'Fristen und Ablauf' });
    const rows = within(rail)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(rows).toEqual([
      expect.stringContaining('Impfpass'),
      expect.stringContaining('Hausrat'),
      'Heute',
      expect.stringContaining('Reisepass'),
    ]);
    // The undated contract is not on the rail.
    expect(within(rail).queryByText('Mietvertrag')).toBeNull();
    for (const badge of within(rail).getAllByText('Abgelaufen')) {
      expect(badge.className).toMatch(/warning/);
      expect(badge.className).not.toMatch(/danger/);
    }
  });

  it('"Verlängert" proposes one more term, writes only on confirmation and moves the start along', async () => {
    await seed();
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Fristen' }));
    const opener = await screen.findByRole('button', { name: 'Verlängert: Hausrat' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Verlängert: Hausrat' });
    // Said before it happens: the old end, and that the start moves to the new term.
    expect(
      within(dialog).getByText(
        'Bisher bis 25. September 2026. Der Beginn wird auf den 26. September 2026 gesetzt.',
      ),
    ).toBeTruthy();
    const field = within(dialog).getByLabelText(/Neues Ende/) as HTMLInputElement;
    // 1 Oct 2025 – 25 Sep 2026 is no whole number of months: the same 360 days once more.
    expect(field.value).not.toBe('');
    // A proposal waits for its confirmation: the first focus is the button that writes it.
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(dialog).getByRole('button', { name: 'Verlängerung speichern' }),
      ),
    );
    const before = (await documentRepo.active().toArray()).find((d) => d.title === 'Hausrat')!;
    expect(before.endDate).toBe('2026-09-25');
    // Enter twice in a row: one renewal, never the next term on top. (The form that starts afresh for the new term:
    // "one write per Verlängert" below.)
    const form = dialog.querySelector('form')!;
    // Each focus on the title, and whether the rail had already moved the row below "Heute" at that moment.
    const focused: boolean[] = [];
    const log = (e: FocusEvent) => {
      if ((e.target as HTMLElement).textContent !== 'Hausrat') return;
      const rows = Array.from(
        screen.getByRole('list', { name: 'Fristen und Ablauf' }).querySelectorAll('li'),
      ).map((li) => li.textContent ?? '');
      focused.push(rows.indexOf('Heute') < rows.findIndex((text) => text.includes('Hausrat')));
    };
    document.addEventListener('focusin', log);
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(async () => {
      const after = (await documentRepo.active().toArray()).find((d) => d.title === 'Hausrat')!;
      expect(after.endDate).toBe('2027-09-20');
      expect(after.startDate).toBe('2026-09-26');
    });
    // The row's "Verlängert" is gone with the new term: the focus is on the row's title, not nowhere.
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Hausrat'));
    // The dialog closed only once the rail showed the new term (the row had moved below "Heute"), and the title
    // got the focus once, after that move: a screen reader hears it once. (In the browser a row moved under the
    // focus drops it, and setting it again read the title twice.)
    await new Promise((r) => setTimeout(r, 50));
    document.removeEventListener('focusin', log);
    expect(focused).toEqual([true]);
    const settled = (await documentRepo.active().toArray()).find((d) => d.title === 'Hausrat')!;
    expect([settled.startDate, settled.endDate]).toEqual(['2026-09-26', '2027-09-20']);
    // "Rückgängig" gives back the old term as a whole: end and start.
    await undoLast();
    const back = (await documentRepo.active().toArray()).find((d) => d.title === 'Hausrat')!;
    expect([back.startDate, back.endDate]).toEqual(['2025-10-01', '2026-09-25']);
  });

  it('a passport renewed before it runs out: no proposal, it starts today, the focus lands on its folder', async () => {
    await documentRepo.create({
      title: 'Pass',
      category: 'identity',
      startDate: '2016-11-07',
      endDate: '2026-11-06',
    } as never);
    page();
    // "Ablage": the folder offers "Verlängert" while it reads "Läuft bald ab".
    const opener = await screen.findByRole('button', { name: 'Verlängert: Pass' });
    fireEvent.click(opener);
    const dialog = await screen.findByRole('dialog', { name: 'Verlängert: Pass' });
    expect(
      within(dialog).getByText(
        'Bisher bis 6. November 2026. Der Beginn wird auf den 29. September 2026 gesetzt.',
      ),
    ).toBeTruthy();
    const field = within(dialog).getByLabelText(/Neues Ende/) as HTMLInputElement;
    // A new paper: its end is on it, not a sum of terms.
    expect(field.value).toBe('');
    expect(
      within(dialog).getByText(
        'Vor dem Ablauf verlängert: das neue Ende steht auf dem neuen Dokument.',
      ),
    ).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(field));
    fireEvent.change(field, { target: { value: '28.09.2036' } });
    fireEvent.blur(field);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verlängerung speichern' }));
    await waitFor(async () => {
      const doc = (await documentRepo.active().toArray()).find((d) => d.title === 'Pass')!;
      expect([doc.startDate, doc.endDate]).toEqual(['2026-09-29', '2036-09-28']);
    });
    // The folder's "Verlängert" is gone with the new term: the focus is on the folder itself.
    await waitFor(() =>
      expect((document.activeElement as HTMLElement | null)?.dataset.row).toBeDefined(),
    );
    expect(document.activeElement?.textContent).toContain('Pass');
  });

  it('without a start nothing is proposed, and an end that is not later is refused', async () => {
    await seed();
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Fristen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Verlängert: Impfpass' }));
    const dialog = await screen.findByRole('dialog', { name: 'Verlängert: Impfpass' });
    const field = within(dialog).getByLabelText(/Neues Ende/) as HTMLInputElement;
    expect(field.value).toBe('');
    // Nothing proposed: the date is what is missing, so the field has the first focus.
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(
      within(dialog).getByText(
        'Ohne Beginn gibt es keinen Vorschlag: bitte das neue Ende eintragen.',
      ),
    ).toBeTruthy();
    fireEvent.change(field, { target: { value: '01.09.2026' } });
    fireEvent.blur(field);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verlängerung speichern' }));
    expect(
      await within(dialog).findByText('Das neue Ende muss nach dem bisherigen liegen.'),
    ).toBeTruthy();
    // Also without a start: a date behind us is what the hint says first.
    fireEvent.change(field, { target: { value: '25.09.2026' } });
    fireEvent.blur(field);
    expect(
      await within(dialog).findByText('Dieses Datum liegt in der Vergangenheit.'),
    ).toBeTruthy();
    const doc = (await documentRepo.active().toArray()).find((d) => d.title === 'Impfpass')!;
    expect(doc.endDate).toBe('2026-09-20');
  });
});

describe('Unterlagen: one vocabulary, and a dialog that follows its row', () => {
  it('near dates say the day or "bald" in words, on the rail and on the folder alike', async () => {
    await documentRepo.create({
      title: 'Handy',
      category: 'contract',
      endDate: '2026-12-31',
      noticeDays: 90,
    } as never);
    await documentRepo.create({
      title: 'Strom',
      category: 'contract',
      endDate: '2026-11-25',
      noticeDays: 30,
    } as never);
    await documentRepo.create({
      title: 'Reisepass',
      category: 'identity',
      endDate: '2026-11-06',
    } as never);
    page();
    // "Ablage": the folders carry the same words as the rail; nothing reads as an order.
    await screen.findByText('Kündigungsfrist endet in 3 Tagen');
    expect(screen.getByText('Kündigungsfrist endet bald')).toBeTruthy();
    expect(screen.getByText('Läuft bald ab')).toBeTruthy();
    expect(screen.queryByText('Jetzt kündigen')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fristen' }));
    const rail = await screen.findByRole('list', { name: 'Fristen und Ablauf' });
    expect(within(rail).getByText('Kündigungsfrist endet in 3 Tagen')).toBeTruthy();
    expect(within(rail).getByText('Kündigungsfrist endet bald')).toBeTruthy();
    expect(within(rail).getByText('Läuft bald ab')).toBeTruthy();
  });

  it('when everything dated ran out long ago, the empty rail says so instead of "no date"', async () => {
    await documentRepo.create({
      title: 'Alte Garantie',
      category: 'warranty',
      endDate: '2025-01-31',
    } as never);
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Fristen' }));
    expect(await screen.findByText('Gerade steht keine Frist an.')).toBeTruthy();
    expect(screen.queryByText('Keine Unterlage hat ein Datum.')).toBeNull();
    expect(screen.getByText(/^1 Unterlage ist seit mehr als 90 Tagen abgelaufen/)).toBeTruthy();
  });

  it('a proposal that still lies in the past puts the first focus on the date, not on saving', async () => {
    // A month that ended 40 days ago: one more month is still behind us.
    await documentRepo.create({
      title: 'Probeabo',
      category: 'contract',
      startDate: '2026-07-21',
      endDate: '2026-08-20',
    } as never);
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Fristen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Verlängert: Probeabo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Verlängert: Probeabo' });
    const field = within(dialog).getByLabelText(/Neues Ende/) as HTMLInputElement;
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(within(dialog).getByText('Dieses Datum liegt in der Vergangenheit.')).toBeTruthy();
  });

  it('the dialog closes when its document is deleted elsewhere', async () => {
    await seed();
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Fristen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Verlängert: Hausrat' }));
    await screen.findByRole('dialog', { name: 'Verlängert: Hausrat' });
    const doc = (await documentRepo.active().toArray()).find((d) => d.title === 'Hausrat')!;
    await documentRepo.remove(doc.id);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Verlängert/ })).toBeNull());
    expect((await documentRepo.active().toArray()).map((d) => d.title)).not.toContain('Hausrat');
  });

  it('the dialog starts afresh when the term changes elsewhere: the field shows the new proposal', async () => {
    await seed();
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Fristen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Verlängert: Hausrat' }));
    const dialog = await screen.findByRole('dialog', { name: 'Verlängert: Hausrat' });
    const first = (within(dialog).getByLabelText(/Neues Ende/) as HTMLInputElement).value;
    const doc = (await documentRepo.active().toArray()).find((d) => d.title === 'Hausrat')!;
    // Another device corrects the term to a whole year that ended on 27 Sep.
    await documentRepo.update(doc.id, { startDate: '2025-09-28', endDate: '2026-09-27' });
    await waitFor(() => {
      const now = (within(dialog).getByLabelText(/Neues Ende/) as HTMLInputElement).value;
      expect(now).not.toBe(first);
    });
    expect(within(dialog).getByText(/^Bisher bis 27\. September 2026\./)).toBeTruthy();
  });
});

describe('Unterlagen: the view stays in the address', () => {
  it('"Fristen" is written into the address and comes back after a reload; "Ablage" is the address without it', async () => {
    await seed();
    const first = pageAt('/vault');
    fireEvent.click(await screen.findByRole('button', { name: 'Fristen' }));
    await screen.findByRole('list', { name: 'Fristen und Ablauf' });
    expect(screen.getByTestId('search').textContent).toBe('?view=deadlines');
    first.unmount();
    // A reload: the same address, a new page.
    pageAt('/vault?view=deadlines');
    expect(await screen.findByRole('list', { name: 'Fristen und Ablauf' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Fristen' }).getAttribute('aria-current'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ablage' }));
    await waitFor(() =>
      expect(screen.queryByRole('list', { name: 'Fristen und Ablauf' })).toBeNull(),
    );
    expect(screen.getByTestId('search').textContent).toBe('');
  });

  it('an unknown view is "Ablage", and closing a new document keeps the view', async () => {
    await seed();
    const first = pageAt('/vault?view=whatever');
    expect(await screen.findByRole('searchbox')).toBeTruthy();
    first.unmount();
    pageAt('/vault?view=deadlines&new=1');
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe('?view=deadlines'));
    expect(await screen.findByRole('list', { name: 'Fristen und Ablauf' })).toBeTruthy();
  });
});

describe('Unterlagen: one write per "Verlängert"', () => {
  afterEach(() => vi.restoreAllMocks());

  it('the form drawn anew for the new term while the dialog closes writes nothing on top', async () => {
    await seed();
    const { spy, release } = holdWrites('before');
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Fristen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Verlängert: Hausrat' }));
    const dialog = await screen.findByRole('dialog', { name: 'Verlängert: Hausrat' });
    const form = dialog.querySelector('form')!;
    fireEvent.submit(form);
    // The write has landed, the dialog has not closed yet: the form starts afresh for the new term.
    await waitFor(() =>
      expect(within(dialog).getByText(/^Bisher bis 20\. September 2027\./)).toBeTruthy(),
    );
    const rebuilt = dialog.querySelector('form')!;
    expect(rebuilt).not.toBe(form);
    fireEvent.submit(rebuilt);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verlängerung speichern' }));
    release();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Verlängert/ })).toBeNull());
    expect(spy).toHaveBeenCalledTimes(1);
    const doc = (await documentRepo.active().toArray()).find((d) => d.title === 'Hausrat')!;
    expect([doc.startDate, doc.endDate]).toEqual(['2026-09-26', '2027-09-20']);
  });

  it('closed and opened again while the write runs: no second write, and the late write closes nothing', async () => {
    await seed();
    const { spy, release } = holdWrites('after');
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Fristen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Verlängert: Hausrat' }));
    let dialog = await screen.findByRole('dialog', { name: 'Verlängert: Hausrat' });
    fireEvent.submit(dialog.querySelector('form')!);
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Verlängert/ })).toBeNull());
    // Opened again at once: the old term is still what is stored.
    fireEvent.click(screen.getByRole('button', { name: 'Verlängert: Hausrat' }));
    dialog = await screen.findByRole('dialog', { name: 'Verlängert: Hausrat' });
    fireEvent.submit(dialog.querySelector('form')!);
    expect(spy).toHaveBeenCalledTimes(1);
    release();
    // The first write lands: the dialog open now stays and starts afresh for the new term.
    await waitFor(() =>
      expect(within(dialog).getByText(/^Bisher bis 20\. September 2027\./)).toBeTruthy(),
    );
    expect(screen.getByRole('dialog', { name: 'Verlängert: Hausrat' })).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(1);
    const doc = (await documentRepo.active().toArray()).find((d) => d.title === 'Hausrat')!;
    expect([doc.startDate, doc.endDate]).toEqual(['2026-09-26', '2027-09-20']);
    // That opening has a write of its own: the next term, on purpose.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Verlängert/ })).toBeNull());
  });
});

describe('file preview: only after a tap, kept nowhere', () => {
  const urls: string[] = [];
  beforeEach(() => {
    urls.length = 0;
    URL.createObjectURL = vi.fn(() => {
      urls.push(`blob:test-${urls.length}`);
      return urls.at(-1)!;
    });
    URL.revokeObjectURL = vi.fn();
  });

  it('offers a preview for pictures only', () => {
    expect(canPreview('image/jpeg')).toBe(true);
    expect(canPreview('image/png')).toBe(true);
    expect(canPreview('application/pdf')).toBe(false);
    expect(canPreview('image/svg+xml')).toBe(false);
    expect(canPreview(undefined)).toBe(false);
  });

  it('reads the file on the tap, shows it, and gives the memory back when hidden or left', async () => {
    await putBlob('doc-1', new Blob(['x'], { type: 'image/png' }));
    const view = render(<FilePreview id="doc-1" fileName="ausweis.png" />);
    // Nothing is read or shown before the tap.
    expect(view.container.querySelector('img')).toBeNull();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau zeigen' }));
    const img = await screen.findByAltText('Vorschau: ausweis.png');
    expect(img.getAttribute('src')).toBe('blob:test-0');
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau ausblenden' }));
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-0'));
    expect(view.container.querySelector('img')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau zeigen' }));
    await screen.findByAltText('Vorschau: ausweis.png');
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
  });

  it('writes nothing: no record, no setting, no further blob, nothing for the sync', async () => {
    await putBlob('doc-1', new Blob(['x'], { type: 'image/png' }));
    const count = async () =>
      Object.fromEntries(
        await Promise.all(db.tables.map(async (tb) => [tb.name, await tb.count()] as const)),
      );
    const before = await count();
    const storage = { ...localStorage };
    render(<FilePreview id="doc-1" fileName="ausweis.png" />);
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau zeigen' }));
    await screen.findByAltText('Vorschau: ausweis.png');
    expect(await count()).toEqual(before);
    expect(await blobKeys()).toEqual(['doc-1']);
    expect({ ...localStorage }).toEqual(storage);
    expect(sessionStorage.length).toBe(0);
  });

  it('a file that is no picture here gets no preview, whatever the synced record says', async () => {
    await putBlob('doc-2', new Blob(['<svg/>'], { type: 'image/svg+xml' }));
    const view = render(<FilePreview id="doc-2" fileName="ausweis.png" />);
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau zeigen' }));
    expect(await screen.findByText('Für diese Datei gibt es keine Vorschau.')).toBeTruthy();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(view.container.querySelector('img')).toBeNull();
  });

  it('two taps while the file is read make one picture, and every URL is given back', async () => {
    await putBlob('doc-1', new Blob(['x'], { type: 'image/png' }));
    const view = render(<FilePreview id="doc-1" fileName="ausweis.png" />);
    const button = screen.getByRole('button', { name: 'Vorschau zeigen' });
    fireEvent.click(button);
    // While the file is read the button takes no second tap.
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('Vorschau wird geladen …');
    fireEvent.click(button);
    await screen.findByAltText('Vorschau: ausweis.png');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('left before the file was read: no object URL is made afterwards', async () => {
    await putBlob('doc-1', new Blob(['x'], { type: 'image/png' }));
    const view = render(<FilePreview id="doc-1" fileName="ausweis.png" />);
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau zeigen' }));
    view.unmount();
    await new Promise((r) => setTimeout(r, 50));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('says so when the file lies on another device', async () => {
    render(<FilePreview id="gone" fileName="x.png" />);
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau zeigen' }));
    expect(await screen.findByText('Die Datei liegt nicht auf diesem Gerät.')).toBeTruthy();
  });
});
