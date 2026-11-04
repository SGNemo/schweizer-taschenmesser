// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { decimalSign, Flow, TimerRing } from './kit';

describe('tool kit', () => {
  it('names the decimal sign of the language (a single character)', () => {
    expect(decimalSign()).toMatch(/^[.,]$/);
  });

  it('the flow has a start, something between and an end', () => {
    const { container } = render(
      <Flow start={<span>a</span>} between={<span>b</span>} end={<span>c</span>} />,
    );
    expect(container.textContent).toBe('abc');
  });

  it.each([
    [0, 1],
    [1, 0],
    [0.25, 0.75],
    [-3, 1],
    [7, 0],
  ])(
    'the ring at %s fills %s of the circle (clamped, hidden from screen readers)',
    (progress, rest) => {
      const { container } = render(
        <TimerRing progress={progress}>
          <p>00:10</p>
        </TimerRing>,
      );
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      const arc = svg.querySelectorAll('circle')[1]!;
      const c = Number(arc.getAttribute('stroke-dasharray'));
      expect(Number(arc.getAttribute('stroke-dashoffset')) / c).toBeCloseTo(rest, 5);
      expect(container.textContent).toBe('00:10');
    },
  );
});
