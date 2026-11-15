// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setPlatform } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { t } from '@/strings';
import { BackupExportForm } from './BackupExport';

function withSave(saveFile: () => Promise<'saved' | 'cancelled'>) {
  setPlatform({ ...createWebPlatform(), saveFile });
}

afterEach(() => setPlatform(undefined));

describe('backup export form', () => {
  it('names the running export on its button while the file is made', async () => {
    let finish!: (r: 'saved') => void;
    withSave(() => new Promise((r) => (finish = r)));
    render(<BackupExportForm />);
    await act(async () => {
      screen.getByRole('button', { name: t.backup.export }).click();
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: t.backup.exporting })).toBeDisabled(),
    );
    expect(screen.getByRole('button', { name: t.backup.encryptedExport })).toBeDisabled();
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    await act(async () => finish('saved'));
    expect(await screen.findByRole('button', { name: t.backup.export })).toBeEnabled();
  });

  it('says calmly that the backup could not be saved instead of failing silently', async () => {
    withSave(() => Promise.reject(new Error('disk full')));
    render(<BackupExportForm />);
    await act(async () => {
      screen.getByRole('button', { name: t.backup.export }).click();
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(t.backup.exportFailed);
    expect(screen.queryByText(/disk full/)).toBeNull();
    expect(screen.getByRole('button', { name: t.backup.export })).toBeEnabled();
  });
});
