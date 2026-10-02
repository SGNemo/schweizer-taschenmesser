// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUiStore } from '@/stores/ui';
import {
  ChecklistWidget,
  DueList,
  GaugeList,
  KpiWidget,
  ProgressList,
  Ring,
  Sparkline,
  StateBadge,
  StatusWidget,
  TileGrid,
  TimelineWidget,
  WidgetSizeContext,
  type WidgetSizeName,
} from '.';

const wrap = (size: WidgetSizeName, ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <WidgetSizeContext.Provider value={size}>{ui}</WidgetSizeContext.Provider>
    </MemoryRouter>,
  );

const SIZES: WidgetSizeName[] = ['s', 'm', 'l'];

describe('widget types: loading and empty states', () => {
  it('show a skeleton while loading', () => {
    wrap('m', <DueList loading entries={[]} />);
    expect(screen.getByRole('status')).toBeTruthy();
  });
  it('show the empty state with its action', () => {
    wrap(
      'm',
      <ProgressList
        loading={false}
        entries={[]}
        empty="Keine Budgets"
        emptyAction={{ label: 'Anlegen', to: '/budgets' }}
      />,
    );
    expect(screen.getByText('Keine Budgets')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Anlegen' }).getAttribute('href')).toBe('/budgets');
  });
});

describe('KpiWidget', () => {
  it.each(SIZES)('renders in size %s', (size) => {
    wrap(
      size,
      <KpiWidget
        loading={false}
        value="897,89 €"
        context="2 überfällig"
        trend={{ direction: 'up', text: '+120 € zum Vormonat' }}
        series={[1, 2, 3]}
        seriesLabel="Verlauf"
      />,
    );
    expect(screen.getByText('897,89 €')).toBeTruthy();
    expect(!!screen.queryByText('2 überfällig')).toBe(size !== 's');
    expect(!!screen.queryByText('+120 € zum Vormonat')).toBe(size !== 's');
    expect(!!screen.queryByRole('img', { name: 'Verlauf' })).toBe(size === 'l');
  });
});

describe('DueList', () => {
  const entries = Array.from({ length: 10 }, (_, i) => ({
    key: `k${i}`,
    title: `Eintrag ${i}`,
    tone: i === 0 ? ('overdue' as const) : ('later' as const),
    label: i === 0 ? 'seit 3 Tagen' : '3. Okt.',
  }));
  it.each([
    ['s', 3],
    ['m', 5],
    ['l', 8],
  ] as const)('shows %s rows: %i', (size, rows) => {
    wrap(size, <DueList loading={false} entries={entries} moreLabel={(n) => `+ ${n} weitere`} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(rows);
    expect(screen.getByText(`+ ${10 - rows} weitere`)).toBeTruthy();
  });
  it('states overdue with text, not only colour', () => {
    wrap('m', <DueList loading={false} entries={entries} />);
    expect(screen.getByText('seit 3 Tagen')).toBeTruthy();
  });
});

describe('StateBadge', () => {
  it('always has text', () => {
    render(<StateBadge tone="today" label="Heute" />);
    expect(screen.getByText('Heute')).toBeTruthy();
  });
});

describe('ProgressList', () => {
  it('marks an overrun with text and icon', () => {
    wrap(
      'm',
      <ProgressList
        loading={false}
        entries={[
          {
            key: 'a',
            title: 'Essen',
            value: 427,
            max: 400,
            detail: '',
            overText: '27,50 € drüber',
          },
          { key: 'b', title: 'Reisen', value: 100, max: 400, detail: '25 % von 400 €' },
        ]}
      />,
    );
    expect(screen.getByText('27,50 € drüber')).toBeTruthy();
    expect(screen.getByText('25 % von 400 €')).toBeTruthy();
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
  });
});

describe('ChecklistWidget', () => {
  beforeEach(() => useUiStore.setState({ toasts: [] }));
  it('ticks and offers undo', async () => {
    const onToggle = vi.fn();
    wrap(
      'm',
      <ChecklistWidget
        loading={false}
        entries={[{ key: 't1', title: 'Steuer', checked: false }]}
        onToggle={onToggle}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Steuer'));
    });
    expect(onToggle).toHaveBeenCalledWith('t1', true);
    const toast = useUiStore.getState().toasts[0]!;
    expect(toast.action?.label).toBe('Rückgängig');
    toast.action!.run();
    expect(onToggle).toHaveBeenLastCalledWith('t1', false);
  });
  it('does not toast when unticking', async () => {
    wrap(
      'm',
      <ChecklistWidget
        loading={false}
        entries={[{ key: 't1', title: 'Steuer', checked: true }]}
        onToggle={vi.fn()}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Steuer'));
    });
    expect(useUiStore.getState().toasts).toHaveLength(0);
  });
});

describe('TimelineWidget', () => {
  const today = [
    { key: 'a', title: 'Teammeeting', time: '10:00', endTime: '11:00', allDay: false },
    { key: 'b', title: 'Friseur', time: '13:00', allDay: false },
  ];
  it.each(SIZES)('renders now marker and next highlight in size %s', (size) => {
    wrap(
      size,
      <TimelineWidget
        loading={false}
        today={today}
        tomorrow={[{ key: 'x', title: 'Morgentermin', time: '08:00', allDay: false }]}
        now="12:00"
      />,
    );
    expect(screen.getByText('Als Nächstes')).toBeTruthy();
    expect(screen.getByLabelText('Jetzt 12:00')).toBeTruthy();
    expect(!!screen.queryByText('Morgentermin')).toBe(size === 'l');
  });
});

describe('other types', () => {
  it('TileGrid calls onOpen', () => {
    const onOpen = vi.fn();
    wrap('m', <TileGrid loading={false} entries={[{ key: 'k', label: 'Bank', onOpen }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bank' }));
    expect(onOpen).toHaveBeenCalled();
  });
  it.each(SIZES)('StatusWidget in size %s has one action', (size) => {
    wrap(
      size,
      <StatusWidget
        icon="lock"
        state="Gesperrt"
        hint="Hinweis"
        action={{ label: 'Entsperren', to: '/accounts' }}
      />,
    );
    expect(screen.getByText('Gesperrt')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Entsperren' })).toBeTruthy();
    expect(!!screen.queryByText('Hinweis')).toBe(size === 'l');
  });
  it.each(SIZES)('GaugeList in size %s writes the percentage', (size) => {
    wrap(
      size,
      <GaugeList
        loading={false}
        entries={[
          {
            key: 'c',
            name: 'C:',
            percent: 92,
            level: 'full',
            detail: '38 GB frei',
            hint: 'Fast voll',
          },
        ]}
      />,
    );
    expect(screen.getAllByText(/92 %/).length).toBeGreaterThan(0);
  });
  it('Ring and Sparkline are accessible / quiet', () => {
    render(<Ring percent={40} label="CPU" />);
    expect(screen.getByRole('img', { name: 'CPU: 40 %' })).toBeTruthy();
    const { container } = render(<Sparkline values={[1]} />);
    expect(container.querySelector('svg')).toBeNull();
  });
});
