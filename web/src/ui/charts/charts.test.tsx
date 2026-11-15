// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setHideValues } from '@/core/focus/hideValues';
import { Bars, Donut, Spark, Trend } from '.';

const euro = (cents: number) => `${(cents / 100).toFixed(2).replace('.', ',')} €`;
const rows = (table: HTMLElement) =>
  within(table)
    .getAllByRole('row')
    .slice(1)
    .map((r) => [...r.querySelectorAll('th,td')].map((c) => c.textContent));

/** The screen-reader table of a chart (the only `table` in the figure). */
const tableOf = (figure: HTMLElement) => figure.querySelector('table') as HTMLElement;

beforeEach(async () => {
  await db.table('_meta').clear();
});

describe('Donut', () => {
  const data = [
    { label: 'Miete', value: 85000 },
    { label: 'Essen', value: 32000 },
    { label: 'Mobilität', value: 9000 },
  ];

  it('is a named figure with a summary; marks and legend are hidden from screen readers, the table is not', () => {
    render(<Donut title="Ausgaben nach Kategorie" data={data} format={euro} />);
    const fig = screen.getByRole('figure', { name: 'Ausgaben nach Kategorie' });
    expect(fig).toHaveAccessibleDescription(
      /3 Anteile, am größten Miete mit 67\s?%. Summe 1260,00 €\./,
    );
    expect(fig.querySelector('svg')!.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(fig.querySelector('ol')!.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(rows(tableOf(fig))).toEqual([
      ['Miete', '850,00 €', expect.stringMatching(/^67\s?%$/)],
      ['Essen', '320,00 €', expect.stringMatching(/^25\s?%$/)],
      ['Mobilität', '90,00 €', expect.stringMatching(/^7\s?%$/)],
    ]);
  });

  it('legend names every slice with value and share; the middle holds the sum', () => {
    render(<Donut title="T" data={data} format={euro} />);
    const legend = screen.getByRole('figure').querySelector('ol')!;
    expect(legend.querySelectorAll('li')).toHaveLength(3);
    expect(legend.textContent).toContain('Miete');
    expect(legend.textContent).toContain('850,00 €');
    expect(screen.getByText('1260,00 €')).toBeInTheDocument();
    expect(screen.getByText('Summe')).toBeInTheDocument();
  });

  it('every slice after the first carries a pattern, so the ring reads without colour', () => {
    const { container } = render(<Donut title="T" data={data} />);
    const slices = container.querySelectorAll('[data-slice]');
    expect(slices).toHaveLength(3);
    expect(slices[0]!.querySelectorAll('circle')).toHaveLength(1);
    expect(slices[1]!.querySelectorAll('circle')[1]!.getAttribute('stroke')).toMatch(
      /^url\(#ch.*-p1\)$/,
    );
    // The pattern the slice points at exists in the same document.
    const ref = slices[1]!.querySelectorAll('circle')[1]!.getAttribute('stroke')!.slice(5, -1);
    expect(container.querySelector(`[id="${ref}"]`)).not.toBeNull();
  });

  it('more than seven values fold into "Sonstiges"', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ label: `K${i}`, value: 10 - i }));
    render(<Donut title="T" data={many} />);
    const table = tableOf(screen.getByRole('figure'));
    expect(rows(table)).toHaveLength(7);
    expect(rows(table)[6]![0]).toBe('Sonstiges');
  });

  it('empty and one-value states', () => {
    const { rerender } = render(<Donut title="T" data={[]} />);
    expect(screen.getByText('Noch keine Werte.')).toBeInTheDocument();
    expect(screen.getByRole('figure').querySelector('svg')).toBeNull();
    rerender(<Donut title="T" data={[{ label: 'Miete', value: 1 }]} emptyText="Leer" />);
    expect(screen.getByRole('figure')).toHaveAccessibleDescription('Ein Anteil: Miete. Summe 1.');
    const circle = screen.getByRole('figure').querySelector('circle')!;
    expect(circle.getAttribute('stroke-dasharray')).toBe('100 0');
  });

  it('a module may name the sum ("pro Monat")', () => {
    render(<Donut title="T" data={data} centreLabel="pro Monat" />);
    expect(screen.getByText('pro Monat')).toBeInTheDocument();
    expect(screen.queryByText('Summe')).toBeNull();
  });

  it('seven values: six named slices and "Sonstiges", each with its own pattern', () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({ label: `K${i}`, value: 10 - i }));
    const { container } = render(<Donut title="T" data={seven} />);
    const slices = [...container.querySelectorAll('[data-slice]')];
    expect(slices).toHaveLength(7);
    const patterns = slices
      .slice(1)
      .map((g) => g.querySelectorAll('circle')[1]?.getAttribute('stroke'));
    expect(new Set(patterns).size).toBe(6);
    expect(patterns.every(Boolean)).toBe(true);
  });

  it('"Werte ausblenden" masks amounts of a sensitive chart, shares stay', async () => {
    await setHideValues(true);
    render(<Donut title="T" data={data} format={euro} sensitive />);
    const fig = screen.getByRole('figure');
    await waitFor(() => expect(fig.textContent).not.toMatch(/\d+,\d\d €/));
    expect(fig).toHaveAccessibleDescription(/^3 Anteile, am größten Miete mit 67\s?%\.$/);
    expect(rows(tableOf(fig))[0]).toEqual(['Miete', 'Ausgeblendet', expect.stringMatching(/67/)]);
    expect(fig.textContent).toContain('••••');
  });

  it('a chart that is not sensitive ignores the setting', async () => {
    await setHideValues(true);
    render(<Donut title="T" data={data} format={euro} />);
    await waitFor(() => expect(screen.getByText('1260,00 €')).toBeInTheDocument());
  });
});

describe('Bars', () => {
  const budgets = [
    { label: 'Essen', value: 32000, target: 30000 },
    { label: 'Freizeit', value: 8000, target: 15000 },
    { label: 'Kleidung', value: 0 },
  ];

  it('over its target a bar is red with an icon and the amount over; others read "von …"', () => {
    const { container } = render(<Bars title="Budgets" data={budgets} format={euro} />);
    const over = container.querySelectorAll('[data-over]');
    expect([...over].every((el) => el.closest('li')?.textContent?.includes('Essen'))).toBe(true);
    // Only the part beyond the mark is red; a zero draws no bar at all.
    expect(container.querySelectorAll('[class*="overPart"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-zero]')).toHaveLength(1);
    expect(screen.getByText('20,00 € drüber')).toBeInTheDocument();
    expect(screen.getByText('20,00 € drüber').querySelector('svg')).not.toBeNull();
    expect(screen.getByText(/von 150,00 €/)).toBeInTheDocument();
    expect(screen.getAllByText('Geplant')).toHaveLength(2); // key and table column
  });

  it('a module names its target; columns over it get the "drüber" key', () => {
    render(
      <Bars title="T" data={budgets} orientation="vertical" targetLabel="Budget" format={euro} />,
    );
    expect(screen.getAllByText('Budget')).toHaveLength(2);
    expect(screen.getByText('drüber')).toBeInTheDocument();
    expect(
      within(tableOf(screen.getByRole('figure'))).getByRole('columnheader', { name: 'Budget' }),
    ).toBeInTheDocument();
  });

  it('summary counts the bars over target; the table holds value and target', () => {
    render(<Bars title="Budgets" data={budgets} format={euro} />);
    const fig = screen.getByRole('figure', { name: 'Budgets' });
    expect(fig).toHaveAccessibleDescription('3 Werte, davon 1 mehr als geplant.');
    expect(rows(tableOf(fig))).toEqual([
      ['Essen', '320,00 € (20,00 € drüber)', '300,00 €'],
      ['Freizeit', '80,00 €', '150,00 €'],
      ['Kleidung', '0,00 €', '–'],
    ]);
  });

  it('scales from zero to the larger of value and target; negatives draw as zero', () => {
    const { container } = render(
      <Bars
        title="T"
        data={[
          { label: 'a', value: 50, target: 80 },
          { label: 'b', value: -10 },
        ]}
      />,
    );
    const rowsEl = container.querySelectorAll('li');
    expect(rowsEl[0]!.style.getPropertyValue('--v')).toBe('0.625');
    expect(rowsEl[0]!.style.getPropertyValue('--t')).toBe('1');
    expect(rowsEl[1]!.style.getPropertyValue('--v')).toBe('0');
  });

  it('without targets there is no key and no target column', () => {
    render(<Bars title="T" data={[{ label: 'a', value: 1 }]} />);
    expect(screen.queryAllByText('Geplant')).toHaveLength(0);
    expect(within(tableOf(screen.getByRole('figure'))).getAllByRole('columnheader')).toHaveLength(
      2,
    );
    expect(screen.getByRole('figure')).toHaveAccessibleDescription('Ein Wert.');
  });

  it('vertical: many columns thin their labels, the last one always shows', () => {
    const months = Array.from({ length: 12 }, (_, i) => ({ label: `M${i + 1}`, value: i + 1 }));
    render(<Bars title="T" data={months} orientation="vertical" />);
    const narrow = [...document.querySelectorAll('[data-n]')].map((el) => el.textContent);
    expect(narrow).toContain('M12');
    expect(narrow.filter((s) => s?.startsWith('M'))).toHaveLength(6);
    // Twelve columns leave no room for a value above each; the table still has them.
    const visible = within(
      screen.getByRole('figure').querySelector('[aria-hidden="true"]') as HTMLElement,
    );
    expect(visible.getByText('12').hasAttribute('data-w')).toBe(false);
    expect(visible.getByText('12').hasAttribute('data-n')).toBe(false);
  });

  it('vertical: a few columns show their values, from 36 rem up to seven', () => {
    const five = Array.from({ length: 5 }, (_, i) => ({
      label: `M${i + 1}`,
      value: (i + 1) * 100,
    }));
    render(<Bars title="T" data={five} orientation="vertical" />);
    const visible = within(
      screen.getByRole('figure').querySelector('[aria-hidden="true"]') as HTMLElement,
    );
    expect(visible.getByText('500').hasAttribute('data-w')).toBe(true);
    expect(visible.getByText('500').hasAttribute('data-n')).toBe(false);
  });

  it('a sensitive chart over target says so without the amount while values are hidden', async () => {
    await setHideValues(true);
    render(<Bars title="T" data={budgets} format={euro} sensitive />);
    await waitFor(() => expect(screen.getByText('mehr als geplant')).toBeInTheDocument());
    expect(screen.getByRole('figure').textContent).not.toMatch(/\d+,\d\d €/);
  });

  it('empty', () => {
    render(<Bars title="T" data={[]} emptyText="Noch keine Budgets." />);
    expect(screen.getByText('Noch keine Budgets.')).toBeInTheDocument();
  });
});

describe('Trend', () => {
  const labels = ['Jan', 'Feb', 'Mär', 'Apr'];

  it('one series: a line, a dot on the newest value, no legend; the table holds every point', () => {
    const { container } = render(
      <Trend
        title="Kontostand"
        labels={labels}
        series={[{ label: 'Saldo', values: [100, 140, null, 120] }]}
      />,
    );
    const fig = screen.getByRole('figure', { name: 'Kontostand' });
    expect(fig).toHaveAccessibleDescription('Saldo: 3 Werte, von 100 bis 120.');
    expect(container.querySelectorAll('path')).toHaveLength(1);
    expect(container.querySelector('path')!.getAttribute('d')).toMatch(/^M0 .*L33\.33 .*M100 /);
    expect(container.querySelectorAll('[style*="--x"]').length).toBeGreaterThan(0);
    expect(container.querySelector('ul')).toBeNull();
    expect(rows(tableOf(fig))).toEqual([
      ['Jan', '100'],
      ['Feb', '140'],
      ['Mär', '–'],
      ['Apr', '120'],
    ]);
  });

  it('two series and a comparison: three line styles and a legend with the latest values', () => {
    const { container } = render(
      <Trend
        title="T"
        labels={labels}
        series={[
          { label: 'Einnahmen', values: [1, 2, 3, 4] },
          { label: 'Ausgaben', values: [2, 2, 2, 3] },
        ]}
        compare={{ label: 'Vorjahr', values: [1, 1, 1, 1] }}
      />,
    );
    const legend = container.querySelector('ul')!;
    expect([...legend.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'EinnahmenApr 4',
      'AusgabenApr 3',
      'VorjahrApr 1',
    ]);
    expect(
      within(tableOf(screen.getByRole('figure')))
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Eintrag', 'Einnahmen', 'Ausgaben', 'Vorjahr']);
  });

  it('area starts at zero; a line may not', () => {
    const series = [{ label: 's', values: [980, 1000, 1020] }];
    const { container, rerender } = render(
      <Trend title="T" labels={['a', 'b', 'c']} series={series} />,
    );
    const ticks = () =>
      [...container.querySelectorAll('[style*="--f"]')].map((el) => el.textContent);
    expect(ticks()).not.toContain('0');
    rerender(<Trend title="T" labels={['a', 'b', 'c']} series={series} variant="area" />);
    expect(ticks()).toContain('0');
    expect(container.querySelectorAll('path')).toHaveLength(2);
  });

  it('a single point is a dot; no values is the empty state', () => {
    const { container, rerender } = render(
      <Trend title="T" labels={['Nov']} series={[{ label: 's', values: [5] }]} />,
    );
    expect(screen.getByRole('figure')).toHaveAccessibleDescription('s: ein Wert, 5.');
    expect(container.querySelector('path')!.getAttribute('d')).toBe('M50 50');
    rerender(<Trend title="T" labels={['Nov']} series={[{ label: 's', values: [null] }]} />);
    expect(screen.getByText('Noch keine Werte.')).toBeInTheDocument();
  });

  it('many points thin the x labels and keep the newest', () => {
    const many = Array.from({ length: 24 }, (_, i) => `M${i + 1}`);
    const { container } = render(
      <Trend title="T" labels={many} series={[{ label: 's', values: many.map((_, i) => i) }]} />,
    );
    const narrow = [...container.querySelectorAll('[data-n]')].map((el) => el.textContent);
    expect(narrow.length).toBeLessThanOrEqual(4);
    expect(narrow).toContain('M24');
  });
});

describe('Spark', () => {
  it('a line, a dot for one value, nothing for none', () => {
    const { container, rerender } = render(<Spark values={[1, 3, 2]} label="Verlauf" />);
    expect(screen.getByRole('img', { name: 'Verlauf' })).toBeInTheDocument();
    expect(container.querySelector('path')).not.toBeNull();
    rerender(<Spark values={[4]} />);
    expect(container.querySelector('circle')).not.toBeNull();
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    rerender(<Spark values={[]} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('area adds a fill; a flat series does not break', () => {
    const { container } = render(<Spark values={[2, 2, 2]} variant="area" />);
    expect(container.querySelectorAll('path')).toHaveLength(2);
    expect(container.querySelector('path')!.getAttribute('d')).not.toContain('NaN');
  });
});

describe('Trend with "Werte ausblenden"', () => {
  it('no amount in the axis, legend, summary or table; the line keeps its shape', async () => {
    await setHideValues(true);
    const { container } = render(
      <Trend
        title="Kontostand"
        labels={['Jan', 'Feb', 'Mär']}
        series={[
          { label: 'Ein', values: [120000, 130000, 125000] },
          { label: 'Aus', values: [90000, 95000, 99000] },
        ]}
        format={euro}
        sensitive
      />,
    );
    const fig = screen.getByRole('figure');
    await waitFor(() => expect(fig.textContent).not.toMatch(/\d{3}/));
    expect(fig).toHaveAccessibleDescription('Ein: 3 Werte. Aus: 3 Werte.');
    expect(rows(tableOf(fig))[0]).toEqual(['Jan', 'Ausgeblendet', 'Ausgeblendet']);
    expect(container.querySelectorAll('path').length).toBeGreaterThan(1);
  });
});
