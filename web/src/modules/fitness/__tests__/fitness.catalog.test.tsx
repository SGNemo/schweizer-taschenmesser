// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CATALOG, GROUPS, PATTERNS, catalogName, catalogNames, patternOf } from '../catalog';
import { ExercisePicto } from '../components/ExercisePicto';
import { WeekPlates } from '../components/WeekPlates';

describe('fitness catalogue', () => {
  it('has about forty exercises in eight groups, every name unique', () => {
    expect(CATALOG.length).toBe(40);
    expect(new Set(CATALOG.map((e) => e.id)).size).toBe(40);
    for (const g of GROUPS)
      expect(
        CATALOG.some((e) => e.group === g),
        g,
      ).toBe(true);
    const names = catalogNames();
    expect(new Set(names.map((n) => n.toLocaleLowerCase())).size).toBe(40);
    expect(names).toContain('Bankdrücken');
  });

  it('knows the pattern of a catalogue exercise and guesses one for own names', () => {
    expect(patternOf(catalogName('pullUp'))).toBe('pullup');
    expect(patternOf('bankdrücken')).toBe('press');
    expect(patternOf('Kurzhantel-Rudern einarmig')).toBe('row');
    expect(patternOf('Morning run')).toBe('run');
    expect(patternOf('Spinning-Kurs')).toBe('bike');
    expect(patternOf('Tischtennis')).toBe('other');
  });

  it('draws every pattern, decorative only', () => {
    for (const p of PATTERNS) {
      const { container, unmount } = render(<ExercisePicto pattern={p} />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.children.length, p).toBeGreaterThan(0);
      unmount();
    }
  });
});

describe('plate week', () => {
  it('fills days with training, outlines plans ahead and says it in words', () => {
    render(
      <WeekPlates
        day="2026-11-04"
        weekStart={1}
        sessions={[
          { date: '2026-11-02' },
          { date: '2026-11-03', planned: true },
          { date: '2026-11-06', planned: true },
        ]}
      />,
    );
    const plates = screen.getByTestId('fitness-plates');
    const states = [...plates.querySelectorAll('[data-state]')].map((e) =>
      e.getAttribute('data-state'),
    );
    // A plan whose day has passed is no outline (nothing reads as „missed“).
    expect(states).toEqual(['done', 'none', 'none', 'none', 'planned', 'none', 'none']);
    expect(plates.getAttribute('aria-label')).toBe(
      'Diese Woche trainiert: Montag; geplant: Freitag',
    );
  });
});
