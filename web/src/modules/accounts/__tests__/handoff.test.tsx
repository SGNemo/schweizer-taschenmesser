// @vitest-environment jsdom
import { cleanup, configure, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import {
  clearVaultEntry,
  offerVaultEntry,
  peekVaultEntry,
  type VaultEntryHandoff,
} from '@/core/handoff/vaultEntry';
import { t } from '@/strings';
import AccountsPage from '../routes/AccountsPage';
import { createVault, decryptAll, isReadable, lockVault, resetAttempts } from '../vault';

configure({ asyncUtilTimeout: 8000 });

const FAST = { m: 64, t: 1, p: 1 };
const MASTER = 'Master-Passwort-Nr-1'; // gitleaks:allow (test fixture)
const f = t.accounts.fields;
const entry: VaultEntryHandoff = {
  title: 'Anonyme Persona: Anna Beispiel',
  username: 'anna.beispiel42',
  password: 'Test-Passwort-nur-fuer-den-Test-1', // gitleaks:allow (test fixture)
  notes: 'Geburtsdatum: 01.02.1995\nStadt: Berlin',
};

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}
const page = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <AccountsPage />
      <Where />
    </MemoryRouter>,
  );

beforeEach(async () => {
  clearVaultEntry();
  lockVault();
  resetAttempts();
  await db.table('accounts_vault').clear();
  await db.table('accounts_entry').clear();
  await createVault(MASTER, FAST);
});
afterEach(() => {
  cleanup();
  clearVaultEntry();
  lockVault();
});

describe('vault: entry handed over by a tool', () => {
  it('opens the new-entry form with everything filled in, takes the entry and drops the flag', async () => {
    offerVaultEntry(entry);
    page('/accounts?handoff=1');
    const dialog = await screen.findByRole('dialog', { name: t.accounts.add });
    expect(screen.getByLabelText(f.title)).toHaveValue(entry.title);
    expect(screen.getByLabelText(f.username)).toHaveValue(entry.username);
    expect(screen.getByLabelText(f.password, { exact: true })).toHaveValue(entry.password);
    expect(screen.getByLabelText(f.notes)).toHaveValue(entry.notes);
    expect(dialog).toBeVisible();
    // forgotten right away, and nothing of it in the address
    await waitFor(() => expect(peekVaultEntry()).toBeUndefined());
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/accounts$/));
    expect(screen.getByTestId('where').textContent).not.toContain(entry.password);
  });

  it('saves like any entry: encrypted, with the right fields', async () => {
    const user = userEvent.setup();
    offerVaultEntry(entry);
    page('/accounts?handoff=1');
    await screen.findByRole('dialog', { name: t.accounts.add });
    await user.click(screen.getByRole('button', { name: t.actions.save }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: t.accounts.add })).toBeNull());
    const saved = (await decryptAll()).filter(isReadable);
    expect(saved).toHaveLength(1);
    expect(saved[0]!.data).toMatchObject({
      title: entry.title,
      username: entry.username,
      password: entry.password,
      notes: entry.notes,
    });
    // the stored row holds ciphertext only
    const raw = JSON.stringify(await db.table('accounts_entry').toArray());
    expect(raw).not.toContain(entry.password);
    expect(raw).not.toContain(entry.username);
  });

  it('does nothing without the flag, and nothing once the entry has expired or is gone', async () => {
    offerVaultEntry(entry);
    page('/accounts');
    await screen.findByRole('button', { name: t.accounts.add });
    expect(screen.queryByRole('dialog', { name: t.accounts.add })).toBeNull();
    cleanup();
    clearVaultEntry();
    page('/accounts?handoff=1');
    await screen.findByRole('button', { name: t.accounts.add });
    expect(screen.queryByRole('dialog', { name: t.accounts.add })).toBeNull();
  });

  it('waits behind the unlock while the vault is locked', async () => {
    const user = userEvent.setup();
    lockVault();
    offerVaultEntry(entry);
    page('/accounts?handoff=1');
    const master = await screen.findByLabelText(t.accounts.lock.password);
    expect(screen.queryByRole('dialog', { name: t.accounts.add })).toBeNull();
    expect(peekVaultEntry()).toEqual(entry);
    await user.type(master, MASTER);
    await user.click(screen.getByRole('button', { name: t.accounts.lock.unlock }));
    await screen.findByRole('dialog', { name: t.accounts.add });
    expect(screen.getByLabelText(f.username)).toHaveValue(entry.username);
  });

  it('a normal new entry is still empty', async () => {
    const user = userEvent.setup();
    page('/accounts');
    await user.click(await screen.findByRole('button', { name: t.accounts.add }));
    await screen.findByRole('dialog', { name: t.accounts.add });
    expect(screen.getByLabelText(f.title)).toHaveValue('');
    expect(screen.getByLabelText(f.username)).toHaveValue('');
    expect(screen.getByLabelText(f.password, { exact: true })).toHaveValue('');
  });
});
