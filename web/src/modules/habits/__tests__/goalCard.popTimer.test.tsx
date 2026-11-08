// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Stored } from '@/core/db/types';
import { GoalCard } from '../components/GoalCard';
import type { Goal } from '../schema';

const goal = {
  id: 'g1',
  name: 'Wasser trinken',
  kind: 'count',
  target: 8,
  unit: 'Gläser',
  period: 'day',
  weeklyTimes: 3,
  order: 0,
} as unknown as Stored<Goal>;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('GoalCard pop animation timer', () => {
  it('leaves no timer behind when the card goes away before the animation ends', () => {
    vi.useFakeTimers();
    const { unmount } = render(
      <ul>
        <GoalCard
          goal={goal}
          entry={undefined}
          map={new Map()}
          day="2026-11-03"
          weekStart={1}
          onEdit={() => {}}
        />
      </ul>,
    );
    fireEvent.click(screen.getByRole('button', { name: '+1 Wasser trinken' }));
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
