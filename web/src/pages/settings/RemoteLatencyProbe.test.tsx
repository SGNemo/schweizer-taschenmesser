// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tDev } from '@/strings.dev';
import { OPENS, PAUSE_MS, RemoteLatencyProbe, resetProbeForTests } from './RemoteLatencyProbe';

const remote = {
  supported: true,
  open: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
};
vi.mock('@/core/platform', () => ({ getPlatform: () => ({ remote }) }));

const t = tDev.latency;
const pad = () => screen.getByTestId('latency-pad');
const result = () => screen.getByTestId('latency-result').textContent ?? '';

async function stroke(moves: number) {
  fireEvent.pointerDown(pad());
  for (let i = 0; i < moves; i += 1) fireEvent.pointerMove(pad());
  await act(async () => {});
  fireEvent.pointerUp(pad());
}

beforeEach(() => {
  resetProbeForTests();
  remote.supported = true;
  remote.open.mockReset();
  remote.send.mockReset().mockRejectedValue(new Error('closed'));
  remote.close.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('remote latency probe (Dev-Preview)', () => {
  it('shows nothing where there is no remote control', () => {
    remote.supported = false;
    const { container } = render(<RemoteLatencyProbe />);
    expect(container).toBeEmptyDOMElement();
  });

  it('one call per pointer event while a finger is down, to a session that is never open, and nothing else', async () => {
    render(<RemoteLatencyProbe />);
    // a pointer that only hovers measures nothing
    fireEvent.pointerMove(pad());
    expect(remote.send).not.toHaveBeenCalled();
    await stroke(5);
    expect(remote.send).toHaveBeenCalledTimes(5);
    for (const call of remote.send.mock.calls)
      expect(call).toEqual([Number.MAX_SAFE_INTEGER, ['mute']]);
    expect(remote.open).not.toHaveBeenCalled();
    expect(remote.close).not.toHaveBeenCalled();
    expect(result()).toMatch(/5 Werte · p50 [\d.]+ ms/);
    // the verdict needs both measurements
    expect(result()).not.toContain(t.fits);
    expect(result()).not.toContain(t.fitsNot);
  });

  it('calls that settle after the finger is up still count', async () => {
    let refuse: (() => void) | undefined;
    remote.send.mockImplementation(
      () =>
        new Promise((_, reject) => {
          refuse = () => reject(new Error('closed'));
        }),
    );
    render(<RemoteLatencyProbe />);
    fireEvent.pointerDown(pad());
    fireEvent.pointerMove(pad());
    fireEvent.pointerUp(pad());
    expect(result()).not.toContain(t.rows.invoke + '1 Werte');
    await act(async () => refuse!());
    await waitFor(() => expect(result()).toContain(t.rows.invoke + '1 Werte'));
  });

  it('stops for good when the call is not refused', async () => {
    remote.send.mockResolvedValue(undefined);
    render(<RemoteLatencyProbe />);
    fireEvent.pointerDown(pad());
    fireEvent.pointerMove(pad());
    expect(await screen.findByRole('alert')).toHaveTextContent(t.aborted);
    fireEvent.pointerMove(pad());
    fireEvent.pointerMove(pad());
    expect(remote.send).toHaveBeenCalledTimes(1);
    // clearing the measurement does not bring it back, nor does opening the page again
    fireEvent.click(screen.getByRole('button', { name: t.reset }));
    fireEvent.pointerDown(pad());
    fireEvent.pointerMove(pad());
    cleanup();
    render(<RemoteLatencyProbe />);
    expect(screen.getByRole('alert')).toHaveTextContent(t.aborted);
    fireEvent.pointerDown(pad());
    fireEvent.pointerMove(pad());
    expect(remote.send).toHaveBeenCalledTimes(1);
  });

  it('stops for good on any answer but "closed": the shell got further than it may', async () => {
    remote.send.mockRejectedValue(new Error('network'));
    render(<RemoteLatencyProbe />);
    fireEvent.pointerDown(pad());
    fireEvent.pointerMove(pad());
    expect(await screen.findByRole('alert')).toHaveTextContent(t.aborted);
    fireEvent.pointerMove(pad());
    expect(remote.send).toHaveBeenCalledTimes(1);
    expect(result()).not.toContain('1 Werte');
  });

  it('never has more than a few calls on their way', () => {
    remote.send.mockImplementation(() => new Promise(() => {}));
    render(<RemoteLatencyProbe />);
    fireEvent.pointerDown(pad());
    for (let i = 0; i < 50; i += 1) fireEvent.pointerMove(pad());
    expect(remote.send).toHaveBeenCalledTimes(8);
  });

  it('measures a few opens without the first, closes each, counts failures by code, then pauses', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let n = 0;
    remote.open.mockImplementation(async () => {
      n += 1;
      if (n === 3) throw new Error('network');
      if (n === 5) throw new Error('Some Text 192.168.0.2');
      return { session: n };
    });
    remote.close.mockImplementation(async (session: number) => {
      if (session === 4) throw new Error('internal');
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<RemoteLatencyProbe />);
    const button = screen.getByRole('button', { name: t.open });
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: t.reset })).toBeDisabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OPENS * 300 + 50);
    });
    await waitFor(() => expect(screen.getByText(t.openFailed(2, OPENS))).toBeInTheDocument());
    expect(remote.open).toHaveBeenCalledTimes(OPENS);
    expect(OPENS).toBeLessThanOrEqual(8);
    expect(remote.close).toHaveBeenCalledTimes(OPENS - 2);
    expect(screen.getByText(t.leftOpen)).toBeInTheDocument();
    for (const call of remote.open.mock.calls) expect(call[0]).toBe('media');
    // six opens: the first is the warm-up, two failed
    expect(result()).toContain(`${t.rows.open}${OPENS - 3} Werte`);
    expect(remote.send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: t.copy }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0]![0]).toContain('failed=network:1,other:1');
    // the PC's limit: no second run for a minute, also after coming back to the page
    expect(button).toBeDisabled();
    cleanup();
    render(<RemoteLatencyProbe />);
    expect(screen.getByRole('button', { name: t.open })).toBeDisabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAUSE_MS + 50);
    });
    expect(screen.getByRole('button', { name: t.open })).toBeEnabled();
  });

  it('leaving the page ends a running series', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    remote.open.mockResolvedValue({ session: 1 });
    render(<RemoteLatencyProbe />);
    fireEvent.click(screen.getByRole('button', { name: t.open }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    cleanup();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OPENS * 300 + 50);
    });
    expect(remote.open).toHaveBeenCalledTimes(1);
    expect(remote.close).toHaveBeenCalledTimes(1);
  });

  it('says whether the call fits once both were measured, and copies one line', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    remote.open.mockResolvedValue({ session: 1 });
    const writeText = vi
      .fn()
      .mockRejectedValueOnce(new Error('denied'))
      .mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<RemoteLatencyProbe />);
    await stroke(3);
    fireEvent.click(screen.getByRole('button', { name: t.open }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OPENS * 300 + 50);
    });
    await waitFor(() => expect(result()).toContain(t.fits));
    // a copy the system refuses is said, not thrown
    fireEvent.click(screen.getByRole('button', { name: t.copy }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: t.copy }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    expect(writeText.mock.calls[1]![0]).toMatch(
      /^nemo-remote-latency v2 \| .* \| invoke n=3 .* \| fits=yes$/,
    );
  });
});
