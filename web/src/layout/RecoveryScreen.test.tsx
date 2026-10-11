// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSafeModeForTests } from '@/core/safemode/safeMode';
import { FatalErrorScreen } from './FatalErrorScreen';
import { RecoveryScreen } from './RecoveryScreen';

const h = vi.hoisted(() => ({
  dumpDb: vi.fn(async () => ({ text: '{}', rows: 2, tables: 1 })),
  repairDb: vi.fn(async (): Promise<unknown> => undefined),
  replaceWithEmptyDb: vi.fn(async () => undefined),
  keepBrokenCopy: vi.fn(async () => true),
  restoreIntoFreshDb: vi.fn(),
}));
vi.mock('@/core/db/health', () => ({
  dumpDb: h.dumpDb,
  repairDb: h.repairDb,
  replaceWithEmptyDb: h.replaceWithEmptyDb,
}));
vi.mock('@/core/db/recovery', () => ({
  keepBrokenCopy: h.keepBrokenCopy,
  restoreIntoFreshDb: h.restoreIntoFreshDb,
}));

const problem = {
  name: 'VersionError',
  message: 'stored by erika@example.test in C:\\Users\\Erika\\x',
  tables: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.keepBrokenCopy.mockResolvedValue(true);
  h.repairDb.mockResolvedValue(undefined);
  vi.stubGlobal('location', { ...window.location, reload: vi.fn(), search: '' });
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  setSafeModeForTests(false);
});

describe('RecoveryScreen', () => {
  it('explains the problem without leaking user names or mail addresses', () => {
    render(<RecoveryScreen problem={problem} />);
    const detail = screen.getByTestId('recovery-detail');
    expect(detail).toHaveTextContent('VersionError');
    expect(detail).not.toHaveTextContent('erika');
    expect(detail).not.toHaveTextContent('Erika');
  });

  it('repair first asks for the copy of the defective state', async () => {
    render(<RecoveryScreen problem={problem} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Datenbank reparieren' })[0]!);
    await waitFor(() => expect(h.repairDb).toHaveBeenCalled());
    expect(h.keepBrokenCopy).toHaveBeenCalledBefore(h.repairDb);
  });

  it('changes nothing when the copy is cancelled', async () => {
    h.keepBrokenCopy.mockResolvedValue(false);
    render(<RecoveryScreen problem={problem} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Datenbank reparieren' })[0]!);
    expect(await screen.findByTestId('recovery-message')).toHaveTextContent(
      'Ohne gesicherte Kopie',
    );
    expect(h.repairDb).not.toHaveBeenCalled();
  });

  it('start with an empty database needs the typed phrase', async () => {
    render(<RecoveryScreen problem={problem} />);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Mit leerer Datenbank neu starten' })[0]!,
    );
    const confirm = await screen.findByRole('button', { name: 'Neu starten' });
    expect(confirm).toBeDisabled();
    expect(h.replaceWithEmptyDb).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'NEU STARTEN' } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(h.replaceWithEmptyDb).toHaveBeenCalled());
    expect(h.keepBrokenCopy).toHaveBeenCalledBefore(h.replaceWithEmptyDb);
  });
});

describe('FatalErrorScreen', () => {
  it('arms safe mode for one start with the visible button', () => {
    render(<FatalErrorScreen error={new Error('boom')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Im Sicheren Modus starten' }));
    expect(localStorage.getItem('tm-safe-mode-once')).toBe('1');
  });

  it('arms safe mode with a triple tap on the logo', () => {
    render(<FatalErrorScreen error={new Error('boom')} />);
    const logo = document.querySelector('button[aria-hidden]')!;
    fireEvent.click(logo);
    fireEvent.click(logo);
    expect(localStorage.getItem('tm-safe-mode-once')).toBeNull();
    fireEvent.click(logo);
    expect(localStorage.getItem('tm-safe-mode-once')).toBe('1');
  });
});
