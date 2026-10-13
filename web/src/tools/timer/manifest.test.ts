import { describe, expect, it } from 'vitest';
import { isRunning } from './logic';
import tool from './manifest';

describe('timer search-bar expression', () => {
  it('offers a line for "timer 10m" and nothing for other input', () => {
    expect(tool.expression?.('timer 10m')?.text).toMatch(/10/);
    expect(tool.expression?.('timer')).toBeUndefined();
    expect(tool.expression?.('calendar')).toBeUndefined();
  });

  it('starts a ten minute countdown when run', async () => {
    await tool.expression!('timer 10m')!.run!();
    const { useTimer } = await import('./engine');
    const s = useTimer.getState();
    expect(s.mode).toBe('timer');
    expect(isRunning(s.timer)).toBe(true);
    expect(s.timer.durationMs).toBe(10 * 60_000);
    s.reset();
  });
});
