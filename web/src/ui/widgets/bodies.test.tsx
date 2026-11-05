// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import {
  FortschrittBody,
  KachelnBody,
  KennzahlBody,
  NotizBody,
  WidgetSizeContext,
  type WidgetSizeName,
} from '.';

const wrap = (size: WidgetSizeName, ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <WidgetSizeContext.Provider value={size}>{ui}</WidgetSizeContext.Provider>
    </MemoryRouter>,
  );

describe('widget bodies (identity v3.1)', () => {
  it('KennzahlBody: figure, unit and context line; the sparkline only at size l', () => {
    const { container, rerender } = wrap(
      'l',
      <KennzahlBody
        value="2.418,60"
        unit="€"
        label="Kontostand"
        context="2 Konten"
        series={[1, 2, 3]}
      />,
    );
    expect(screen.getByText('Kontostand')).toBeInTheDocument();
    expect(screen.getByText('2 Konten')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
    rerender(
      <MemoryRouter>
        <WidgetSizeContext.Provider value="s">
          <KennzahlBody value="2.418,60" context="2 Konten" series={[1, 2, 3]} />
        </WidgetSizeContext.Provider>
      </MemoryRouter>,
    );
    expect(container.querySelector('svg')).toBeNull();
  });

  it('KachelnBody: a figure, a label and a state line per tile; states carry words, never colour alone', () => {
    wrap(
      'm',
      <KachelnBody
        tiles={[
          {
            key: 'a',
            value: '12',
            label: 'Abgelaufen',
            state: '3 diese Woche',
            tone: 'danger',
            to: '/x',
          },
          { key: 'b', value: '6', label: 'Frist in Sicht' },
          { key: 'c', value: '1', label: 'C' },
          { key: 'd', value: '2', label: 'D' },
          { key: 'e', value: '5', label: 'E' },
        ]}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByRole('link', { name: /Abgelaufen/ })).toHaveAttribute('href', '/x');
    expect(screen.getByText('3 diese Woche')).toHaveAttribute('data-tone', 'danger');
  });

  it('FortschrittBody: rings or bars by prop, an overrun says so in words', () => {
    const entries = [
      { key: 'a', title: 'Lebensmittel', value: 350, max: 400, detail: '88 %' },
      { key: 'b', title: 'Freizeit', value: 130, max: 100, detail: '', overText: '30 € drüber' },
    ];
    const { container, unmount } = wrap('m', <FortschrittBody kind="rings" entries={entries} />);
    expect(container.querySelector('[data-kind="rings"]')).not.toBeNull();
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getByText('30 € drüber')).toBeInTheDocument();
    unmount();
    const bars = wrap('m', <FortschrittBody kind="bars" entries={entries} />);
    expect(bars.container.querySelector('[data-kind="bars"]')).not.toBeNull();
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
  });

  it('NotizBody: a serif title with a mark, the first lines by size, a meta line', () => {
    wrap(
      's',
      <NotizBody
        title="Einkauf"
        lines={['Milch', 'Eier', 'Brot']}
        meta="vor 2 Std"
        mark={<i data-testid="mark" />}
      />,
    );
    expect(screen.getByText('Einkauf')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('vor 2 Std')).toBeInTheDocument();
    expect(screen.getByTestId('mark').closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
