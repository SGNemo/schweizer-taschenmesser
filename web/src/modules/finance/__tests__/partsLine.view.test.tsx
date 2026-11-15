// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PartsLine } from '../components/OverviewTab';

describe('finance breakdown line (polish p1: an amount never breaks off its words)', () => {
  it('keeps each part in one unbreakable span, the dot at the end of its part, the text unchanged', () => {
    const text =
      'Kontostand 12.616,33 € · offene Rechnungen −1.017,84 € · Abos bis Monatsende −23,98 €';
    const { container } = render(
      <p>
        <PartsLine text={text} />
      </p>,
    );
    const spans = [...container.querySelectorAll('p > span')];
    expect(spans.map((s) => s.textContent)).toEqual([
      'Kontostand 12.616,33 € ·',
      'offene Rechnungen −1.017,84 € ·',
      'Abos bis Monatsende −23,98 €',
    ]);
    expect(spans.every((s) => s.className.includes('nowrap'))).toBe(true);
    expect(container.textContent).toBe(text);
  });

  it('a single part is one span', () => {
    const { container } = render(<PartsLine text="Kontostand 1,00 €" />);
    expect(container.querySelectorAll('span')).toHaveLength(1);
  });
});
