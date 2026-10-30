// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { t } from '@/strings';
import { ToolsDialog } from '../components/ToolsDialog';
import { createVault, lockVault, resetAttempts } from '../vault';

const FAST = { m: 64, t: 1, p: 1 };
const MASTER = 'Master-Passwort-Nr-1'; // gitleaks:allow
const tl = t.accounts.tools;

beforeEach(async () => {
  lockVault();
  resetAttempts();
  await db.table('accounts_vault').clear();
  await db.table('accounts_entry').clear();
  await createVault(MASTER, FAST);
});
afterEach(() => lockVault());

describe('changing the master password', () => {
  it('a weak new password needs one explicit yes, a strong one does not', async () => {
    const user = userEvent.setup();
    render(<ToolsDialog open onClose={() => undefined} entries={[]} />);
    await user.type(await screen.findByLabelText(tl.oldPassword), MASTER);
    const submit = screen.getByRole('button', { name: tl.changePassword });

    await user.type(screen.getByLabelText(tl.newPassword), '1234567890');
    expect(await screen.findByTestId('weak-password')).toBeInTheDocument();
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole('switch', { name: t.accounts.setup.weakAck }));
    await waitFor(() => expect(submit).toBeEnabled());

    // Several words are strong: the notice and the extra yes are gone.
    await user.click(screen.getByRole('button', { name: t.accounts.setup.suggest }));
    await waitFor(() => expect(screen.queryByTestId('weak-password')).toBeNull());
    await waitFor(() => expect(submit).toBeEnabled());
  });
});
