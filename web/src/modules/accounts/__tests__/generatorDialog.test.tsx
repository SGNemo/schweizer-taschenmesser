// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setPlatform } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { t } from '@/strings';
import { GeneratorDialog } from '../components/GeneratorDialog';
import { clearGeneratedHistory } from '../history';

const g = t.accounts.generator;
const writeSensitive = vi.fn<(text: string, ms: number) => Promise<void>>(async () => {});

beforeEach(() => {
  clearGeneratedHistory();
  writeSensitive.mockClear();
  const base = createWebPlatform();
  setPlatform({ ...base, clipboard: { ...base.clipboard, writeSensitive } });
});
afterEach(() => setPlatform(undefined));

describe('GeneratorDialog', () => {
  it('hands the shown password to "save as account"', async () => {
    const onSaveAs = vi.fn();
    render(<GeneratorDialog open onClose={() => {}} onSaveAs={onSaveAs} />);
    const shown = (await screen.findByTestId('generated')).textContent ?? '';
    expect(shown).toHaveLength(20);
    await userEvent.click(screen.getByRole('button', { name: g.saveAsAccount }));
    expect(onSaveAs).toHaveBeenCalledWith(shown);
  });

  it('copies only, with the 30 s clipboard clearing', async () => {
    const onSaveAs = vi.fn();
    render(<GeneratorDialog open onClose={() => {}} onSaveAs={onSaveAs} />);
    const shown = (await screen.findByTestId('generated')).textContent ?? '';
    await userEvent.click(screen.getByRole('button', { name: g.copyOnly }));
    expect(writeSensitive).toHaveBeenCalledWith(shown, 30_000);
    expect(onSaveAs).not.toHaveBeenCalled();
  });

  it('lists rerolled values in the history (max. 5)', async () => {
    render(<GeneratorDialog open onClose={() => {}} onSaveAs={() => {}} />);
    await screen.findByTestId('generated');
    for (let i = 0; i < 7; i++)
      await userEvent.click(screen.getByRole('button', { name: g.regenerate }));
    const list = await screen.findByTestId('generator-history');
    await waitFor(() => expect(list.querySelectorAll('li')).toHaveLength(5));
  });
});
