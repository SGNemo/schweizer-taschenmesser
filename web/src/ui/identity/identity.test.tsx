// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BankCard, CalendarLeaf, HeroFigure, Ring, Sky, skyKind } from './index';
import { dominantColor } from './coverTone';

describe('identity building blocks', () => {
  it('skyKind: night wins, rain-like groups are rain, partly/cloudy/fog are cloudy, the rest is clear', () => {
    expect(skyKind('rain', true)).toBe('night');
    for (const g of ['drizzle', 'rain', 'showers', 'snow', 'thunder'])
      expect(skyKind(g, false)).toBe('rain');
    for (const g of ['partly', 'cloudy', 'fog']) expect(skyKind(g, false)).toBe('cloudy');
    expect(skyKind('clear', false)).toBe('clear');
    expect(skyKind(undefined, false)).toBe('clear');
  });

  it('Sky is decoration: hidden from assistive tech, carries its kind', () => {
    render(<Sky kind="rain" />);
    const sky = screen.getByTestId('sky');
    expect(sky).toHaveAttribute('aria-hidden', 'true');
    expect(sky).toHaveAttribute('data-sky', 'rain');
  });

  it('BankCard keeps the figures as real text', () => {
    render(
      <BankCard
        name="Girokonto"
        balance="12.410,93 €"
        detail="verfügbar 11.204,10 €"
        tail="···· 4021"
      />,
    );
    const card = screen.getByTestId('bank-card');
    expect(card).toHaveTextContent('Girokonto');
    expect(card).toHaveTextContent('12.410,93 €');
    expect(card).toHaveTextContent('verfügbar 11.204,10 €');
  });

  it('Ring describes itself and draws every part', () => {
    render(
      <Ring
        label="3 Kategorien"
        parts={[
          { label: 'A', share: 5 },
          { label: 'B', share: 3 },
          { label: 'C', share: 2 },
        ]}
        centre="3"
      />,
    );
    const ring = screen.getByRole('img', { name: '3 Kategorien' });
    expect(ring.style.background).toContain('conic-gradient');
    expect(ring.style.background.match(/color-mix/g)).toHaveLength(3);
    expect(ring).toHaveTextContent('3');
  });

  it('CalendarLeaf shows month, day and (not when small) the weekday', () => {
    const { rerender } = render(<CalendarLeaf month="Sep" day="29" weekday="Dienstag" />);
    expect(screen.getByTestId('calendar-leaf')).toHaveTextContent('Sep29Dienstag');
    rerender(<CalendarLeaf month="Sep" day="29" weekday="Dienstag" size="sm" />);
    expect(screen.getByTestId('calendar-leaf')).not.toHaveTextContent('Dienstag');
  });

  it('HeroFigure: value, unit and its context line', () => {
    render(
      <HeroFigure
        label="Kontostand"
        value="14"
        unit="°"
        detail="fühlt sich an wie 12°"
        type="thin"
        testId="v"
      />,
    );
    expect(screen.getByTestId('v')).toHaveTextContent('14°');
    expect(screen.getByText('fühlt sich an wie 12°')).toBeInTheDocument();
  });
});

describe('cover tone', () => {
  const px = (r: number, g: number, b: number, n: number) =>
    Array.from({ length: n }, () => [r, g, b, 255]).flat();

  it('picks the saturated colour over a black border and a white one', () => {
    const data = [...px(0, 0, 0, 60), ...px(255, 255, 255, 40), ...px(180, 40, 120, 30)];
    const tone = dominantColor(data)!;
    expect(tone.r).toBeGreaterThan(tone.g + 60);
    expect(tone.b).toBeGreaterThan(tone.g);
  });

  it('gives nothing for transparent or grey-only pictures', () => {
    expect(dominantColor([10, 20, 30, 0, 40, 50, 60, 0])).toBeUndefined();
    expect(dominantColor(px(0, 0, 0, 20))).toBeUndefined();
    expect(dominantColor([])).toBeUndefined();
  });
});
