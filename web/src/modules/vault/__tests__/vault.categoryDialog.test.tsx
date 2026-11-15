// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCategory, documentRepo } from '../repo';
import VaultPage from '../routes/VaultPage';

const page = () =>
  render(
    <MemoryRouter>
      <VaultPage />
    </MemoryRouter>,
  );

/** Without any document there are no folder tabs: the "⋯" menu holds the way in. */
async function openFromMenu() {
  fireEvent.click(await screen.findByRole('button', { name: 'Weitere Aktionen' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Kategorien bearbeiten' }));
}

describe('vault folders', () => {
  beforeEach(async () => {
    await db.table('vault_document').clear();
    await db.table('vault_category').clear();
  });

  it('the folder tabs show the user’s own folder (also while empty) with its count', async () => {
    await documentRepo.create({ title: 'Mietvertrag', category: 'contract' } as never);
    await createCategory({ name: 'Fahrzeug', tone: 2, icon: 'car', order: 6 });
    page();
    const tabs = await screen.findByTestId('vault-folders');
    await waitFor(() =>
      expect(within(tabs).getByRole('button', { name: /Fahrzeug 0/ })).toBeTruthy(),
    );
    expect(within(tabs).getByRole('button', { name: /Verträge 1/ })).toBeTruthy();
    // An empty built-in folder is no tab.
    expect(within(tabs).queryByRole('button', { name: /Steuer/ })).toBeNull();
  });

  it('deleting a folder with documents names the count and moves them; nothing is lost', async () => {
    const a = await documentRepo.create({ title: 'Handyvertrag', category: 'contract' } as never);
    const b = await documentRepo.create({ title: 'Stromvertrag', category: 'contract' } as never);
    page();
    await screen.findByText('Handyvertrag');
    fireEvent.click(screen.getByRole('button', { name: 'Kategorien bearbeiten' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Verträge löschen' }));
    expect((await screen.findByTestId('vault-category-in-use')).textContent).toBe(
      '2 Unterlagen sind in dieser Kategorie.',
    );
    expect((screen.getByLabelText('Verschieben nach') as HTMLSelectElement).value).toBe('other');
    fireEvent.click(screen.getByRole('button', { name: 'Löschen und verschieben' }));
    await waitFor(async () => expect((await documentRepo.get(a.id))?.category).toBe('other'));
    expect((await documentRepo.get(b.id))?.category).toBe('other');
    expect(await documentRepo.active().count()).toBe(2);
    // Back in the list, the folder is gone and "Ohne Kategorie" holds both.
    const list = await screen.findByTestId('vault-categories');
    await waitFor(() => expect(within(list).queryByText('Verträge')).toBeNull());
    expect(within(list).getByText('Ohne Kategorie').closest('li')).toHaveTextContent(
      '2 Unterlagen',
    );
  });

  it('"Ohne Kategorie" has no tools: it can neither be edited nor deleted', async () => {
    page();
    await openFromMenu();
    const list = await screen.findByTestId('vault-categories');
    const row = within(list).getByText('Ohne Kategorie').closest('li')!;
    expect(within(row as HTMLElement).queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Ohne Kategorie löschen' })).toBeNull();
  });

  it('a new folder is added from the dialog and refuses a name that exists', async () => {
    page();
    await openFromMenu();
    fireEvent.click(await screen.findByRole('button', { name: /Neue Kategorie/ }));
    const name = await screen.findByLabelText('Name');
    fireEvent.change(name, { target: { value: 'verträge' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Eine Kategorie mit diesem Namen gibt es schon.')).toBeTruthy();
    fireEvent.change(name, { target: { value: 'Fahrzeug' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const list = await screen.findByTestId('vault-categories');
    await waitFor(() => expect(within(list).getByText('Fahrzeug')).toBeTruthy());
  });

  it('"+" beside the tabs opens the new-folder form directly; a chosen empty folder offers to add a document', async () => {
    await documentRepo.create({ title: 'Mietvertrag', category: 'contract' } as never);
    page();
    await screen.findByText('Mietvertrag');
    fireEvent.click(screen.getByRole('button', { name: 'Neue Kategorie' }));
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Fahrzeug' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const tabs = screen.getByTestId('vault-folders');
    fireEvent.click(await within(tabs).findByRole('button', { name: /Fahrzeug 0/ }));
    expect(await screen.findByText('Noch keine Unterlagen in „Fahrzeug“.')).toBeTruthy();
    expect(
      within(screen.getByTestId('vault-empty')).getByRole('button', {
        name: 'Unterlage eintragen',
      }),
    ).toBeTruthy();
  });

  it('the focus follows the dialog: the form’s field, the question’s choice, back to "Fertig"', async () => {
    await documentRepo.create({ title: 'Handyvertrag', category: 'contract' } as never);
    page();
    await screen.findByText('Handyvertrag');
    fireEvent.click(screen.getByRole('button', { name: 'Kategorien bearbeiten' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Steuer bearbeiten' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Name')));
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fertig' })),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Verträge löschen' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText('Verschieben nach')),
    );
  });

  it('a folder made with "+" is chosen at once', async () => {
    await documentRepo.create({ title: 'Mietvertrag', category: 'contract' } as never);
    page();
    await screen.findByText('Mietvertrag');
    fireEvent.click(screen.getByRole('button', { name: 'Neue Kategorie' }));
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Garten' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Noch keine Unterlagen in „Garten“.')).toBeTruthy();
  });
});
