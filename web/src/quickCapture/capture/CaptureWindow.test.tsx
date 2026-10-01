// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll } from '@/core/ai/testing';
import { db } from '@/core/db/db';
import { setPlatform, type DesktopService } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { setNow } from '@/core/time/now';
import { t } from '@/strings';
import { writePrefs } from '../device';
import { CaptureWindow } from './CaptureWindow';

let open: () => void;
const desktop = (over: Partial<DesktopService> = {}): DesktopService => ({
  ...createWebPlatform().desktop,
  supported: true,
  hideCapture: vi.fn(async () => undefined),
  onCaptureOpen: (cb) => {
    open = cb;
    return () => undefined;
  },
  ...over,
});

beforeEach(async () => {
  localStorage.clear();
  setNow(() => new Date(2026, 8, 30, 10, 0).getTime());
  await clearAll();
});
afterEach(() => {
  setPlatform(undefined);
  setNow();
});

const box = () => screen.findByRole('textbox', { name: t.quickCapture.inputLabel });

describe('CaptureWindow', () => {
  it('saves, confirms and lets you undo', async () => {
    const d = desktop();
    setPlatform({ ...createWebPlatform(), desktop: d });
    const user = userEvent.setup();
    render(<CaptureWindow />);
    await user.type(await box(), 'Blumen gießen{Enter}');
    expect(await screen.findByTestId('capture-saved')).toHaveTextContent('Gespeichert in ToDos');
    await user.click(screen.getByRole('button', { name: t.quickCapture.undo }));
    await waitFor(async () =>
      expect((await db.table('todos_task').toArray())[0]?.deletedAt).toBeTruthy(),
    );
    expect(await box()).toBeInTheDocument();
  });

  it('hides on Escape', async () => {
    const d = desktop();
    setPlatform({ ...createWebPlatform(), desktop: d });
    const user = userEvent.setup();
    render(<CaptureWindow />);
    await user.type(await box(), 'x{Escape}');
    expect(d.hideCapture).toHaveBeenCalled();
  });

  it('starts empty each time it opens and never reads the clipboard by default', async () => {
    const readClipboard = vi.fn(async () => 'geheim');
    setPlatform({ ...createWebPlatform(), desktop: desktop({ readClipboard }) });
    const user = userEvent.setup();
    render(<CaptureWindow />);
    await user.type(await box(), 'alter Text');
    await act(async () => open());
    await waitFor(async () => expect(await box()).toHaveValue(''));
    expect(readClipboard).not.toHaveBeenCalled();
  });

  it('pre-fills from the clipboard only when the user switched it on', async () => {
    const readClipboard = vi.fn(async () => 'https://example.org/x');
    setPlatform({ ...createWebPlatform(), desktop: desktop({ readClipboard }) });
    writePrefs({ clipboard: true });
    render(<CaptureWindow />);
    await box();
    await act(async () => open());
    await waitFor(async () => expect(await box()).toHaveValue('https://example.org/x'));
    expect(readClipboard).toHaveBeenCalledTimes(1);
  });
});
