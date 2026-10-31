// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegexRequest } from './logic';
import { runRegex } from './logic';

const mocks = vi.hoisted(() => ({
  runInBrowser: vi.fn(),
  supported: true,
}));
vi.mock('./run', () => ({
  runInBrowser: mocks.runInBrowser,
  workerSupported: () => mocks.supported,
}));

import RegexTool from './View';
import { MAX_TEXT } from './logic';

beforeEach(() => {
  vi.useFakeTimers();
  mocks.supported = true;
  mocks.runInBrowser.mockReset();
  // Same answer the worker would give, without a worker.
  mocks.runInBrowser.mockImplementation((req: RegexRequest) => ({
    result: Promise.resolve(runRegex(req)),
    cancel: vi.fn(),
  }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const type = (id: string, value: string) =>
  fireEvent.change(screen.getByTestId(id), { target: { value } });
const settle = () => act(async () => void (await vi.advanceTimersByTimeAsync(300)));

describe('RegexTool', () => {
  it('waits for a pattern', () => {
    render(<RegexTool />);
    expect(screen.getByText('Gib ein Muster und einen Text ein.')).toBeInTheDocument();
    expect(mocks.runInBrowser).not.toHaveBeenCalled();
  });

  it('lists matches with numbered and named groups and highlights them with numbers', async () => {
    render(<RegexTool />);
    type('regex-pattern', '(?<k>\\w)(\\d)');
    type('regex-text', 'a1 b2');
    await settle();
    expect(screen.getByTestId('regex-count')).toHaveTextContent('2 Treffer');
    const hits = screen.getByTestId('regex-hits').textContent!;
    expect(hits).toContain('Treffer 1');
    expect(hits).toContain('Gruppe 1, Gruppe „k“');
    expect(hits).toContain('Gruppe 2');
    const marks = screen.getByTestId('regex-highlight').querySelectorAll('mark');
    expect([...marks].map((m) => m.textContent)).toEqual(['a11', 'b22']);
  });

  it('previews the replacement', async () => {
    render(<RegexTool />);
    type('regex-pattern', '(\\d)');
    type('regex-text', 'a1 b2');
    type('regex-replacement', '<$1>');
    await settle();
    expect(screen.getByTestId('regex-replaced')).toHaveTextContent('a<1> b<2>');
  });

  it('flags toggle the run', async () => {
    render(<RegexTool />);
    type('regex-pattern', 'A');
    type('regex-text', 'a');
    await settle();
    expect(screen.getByTestId('regex-count')).toHaveTextContent('Kein Treffer.');
    fireEvent.click(screen.getByLabelText(/^i – /));
    await settle();
    expect(screen.getByTestId('regex-count')).toHaveTextContent('1 Treffer');
  });

  it('tells about an invalid pattern', async () => {
    render(<RegexTool />);
    type('regex-pattern', '(');
    type('regex-text', 'x');
    await settle();
    expect(screen.getByTestId('regex-invalid')).toHaveTextContent('Das Muster ist nicht gültig.');
  });

  it('says "Muster zu aufwendig" when the run times out', async () => {
    mocks.runInBrowser.mockImplementation(() => ({
      result: Promise.resolve({ timeout: true }),
      cancel: vi.fn(),
    }));
    render(<RegexTool />);
    type('regex-pattern', '(a+)+$');
    type('regex-text', 'aaaa');
    await settle();
    expect(screen.getByTestId('regex-timeout')).toHaveTextContent('Muster zu aufwendig');
  });

  it('does not run a too long text', async () => {
    render(<RegexTool />);
    type('regex-pattern', 'a');
    type('regex-text', 'a'.repeat(MAX_TEXT + 1));
    await settle();
    expect(screen.getByTestId('regex-too-long')).toBeInTheDocument();
    expect(mocks.runInBrowser).not.toHaveBeenCalled();
  });

  it('cancels an older run when the input changes', async () => {
    const cancel = vi.fn();
    mocks.runInBrowser.mockImplementation(() => ({ result: new Promise(() => {}), cancel }));
    render(<RegexTool />);
    type('regex-pattern', 'a');
    await settle();
    type('regex-pattern', 'ab');
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('explains where no worker exists', () => {
    mocks.supported = false;
    render(<RegexTool />);
    expect(
      screen.getByText('Dieses Gerät kann den Tester nicht sicher ausführen.'),
    ).toBeInTheDocument();
  });
});
