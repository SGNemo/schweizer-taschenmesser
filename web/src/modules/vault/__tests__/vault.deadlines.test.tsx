// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blobKeys, putBlob } from '@/core/blobs';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { FilePreview, canPreview } from '../components/FilePreview';
import { documentRepo } from '../repo';
import VaultPage from '../routes/VaultPage';

const page = () =>
  render(
    <MemoryRouter>
      <VaultPage />
    </MemoryRouter>,
  );

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
    fireEvent.click(await screen.findByRole('button', { name: 'Verlängert: Hausrat' }));
    const dialog = await screen.findByRole('dialog', { name: 'Verlängert: Hausrat' });
    expect(within(dialog).getByText('Bisher bis 25. September 2026.')).toBeTruthy();
    const field = within(dialog).getByLabelText(/Neues Ende/) as HTMLInputElement;
    // 1 Oct 2025 – 25 Sep 2026 is no whole number of months: the same 360 days once more.
    expect(field.value).not.toBe('');
    const before = (await documentRepo.active().toArray()).find((d) => d.title === 'Hausrat')!;
    expect(before.endDate).toBe('2026-09-25');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verlängerung speichern' }));
    await waitFor(async () => {
      const after = (await documentRepo.active().toArray()).find((d) => d.title === 'Hausrat')!;
      expect(after.endDate).toBe('2027-09-20');
      expect(after.startDate).toBe('2026-09-26');
    });
  });

  it('without a start nothing is proposed, and an end that is not later is refused', async () => {
    await seed();
    page();
    fireEvent.click(await screen.findByRole('button', { name: 'Fristen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Verlängert: Impfpass' }));
    const dialog = await screen.findByRole('dialog', { name: 'Verlängert: Impfpass' });
    const field = within(dialog).getByLabelText(/Neues Ende/) as HTMLInputElement;
    expect(field.value).toBe('');
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
    const doc = (await documentRepo.active().toArray()).find((d) => d.title === 'Impfpass')!;
    expect(doc.endDate).toBe('2026-09-20');
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

  it('says so when the file lies on another device', async () => {
    render(<FilePreview id="gone" fileName="x.png" />);
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau zeigen' }));
    expect(await screen.findByText('Die Datei liegt nicht auf diesem Gerät.')).toBeTruthy();
  });
});
