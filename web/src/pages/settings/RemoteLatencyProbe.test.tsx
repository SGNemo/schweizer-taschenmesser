// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tDev } from '@/strings.dev';
import { RemoteLatencyProbe } from './RemoteLatencyProbe';

const remote = {
  supported: true,
  open: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
};
vi.mock('@/core/platform', () => ({ getPlatform: () => ({ remote }) }));

const t = tDev.latency;

beforeEach(() => {
  remote.supported = true;
  remote.open.mockReset();
  remote.send.mockReset().mockRejectedValue('closed');
  remote.close.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('remote latency probe (Dev-Preview)', () => {
  it('shows nothing where there is no remote control', () => {
    remote.supported = false;
    const { container } = render(<RemoteLatencyProbe />);
    expect(container).toBeEmptyDOMElement();
  });

  it('one call per pointer event, to a session that is never open, and nothing else', async () => {
    render(<RemoteLatencyProbe />);
    const pad = screen.getByTestId('latency-pad');
    for (let i = 0; i < 5; i += 1) fireEvent.pointerMove(pad);
    await act(async () => {});
    fireEvent.pointerUp(pad);
    expect(remote.send).toHaveBeenCalledTimes(5);
    for (const call of remote.send.mock.calls)
      expect(call).toEqual([Number.MAX_SAFE_INTEGER, ['mute']]);
    expect(remote.open).not.toHaveBeenCalled();
    const result = screen.getByTestId('latency-result');
    expect(result.textContent).toContain('5 Werte');
    // our part needs both measurements
    expect(result.textContent).toContain(t.none);
  });

  it('stops for good when the call is not refused', async () => {
    remote.send.mockResolvedValue(undefined);
    render(<RemoteLatencyProbe />);
    const pad = screen.getByTestId('latency-pad');
    fireEvent.pointerMove(pad);
    expect(await screen.findByRole('alert')).toHaveTextContent(t.aborted);
    fireEvent.pointerMove(pad);
    fireEvent.pointerMove(pad);
    expect(remote.send).toHaveBeenCalledTimes(1);
  });

  it('measures ten opens, closes each, counts the ones that failed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let n = 0;
    remote.open.mockImplementation(async () => {
      n += 1;
      if (n === 3) throw 'unreachable';
      return { session: n };
    });
    render(<RemoteLatencyProbe />);
    fireEvent.click(screen.getByRole('button', { name: t.open }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 300 + 50);
    });
    await waitFor(() => expect(remote.open).toHaveBeenCalledTimes(10));
    await waitFor(() => expect(screen.getByText(t.openFailed(1))).toBeInTheDocument());
    expect(remote.close).toHaveBeenCalledTimes(9);
    for (const call of remote.open.mock.calls) expect(call[0]).toBe('media');
    expect(screen.getByTestId('latency-result').textContent).toContain('9 Werte');
    expect(remote.send).not.toHaveBeenCalled();
  });

  it('copies one line of numbers', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<RemoteLatencyProbe />);
    const pad = screen.getByTestId('latency-pad');
    fireEvent.pointerMove(pad);
    await act(async () => {});
    fireEvent.pointerUp(pad);
    fireEvent.click(screen.getByRole('button', { name: t.copy }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0]![0]).toMatch(/^nemo-remote-latency v1 \| .* \| invoke n=1 /);
  });
});
