// @vitest-environment jsdom
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { t } from '@/strings';
import PlotMode from './PlotMode';

configure({ asyncUtilTimeout: 5000 });
const s = t.tools.calc.pro.plot;

afterEach(cleanup);

const line = (name: string) => screen.queryByTestId(`plot-line-${name}`);
const d = (name: string) => line(name)?.getAttribute('d') ?? '';

describe('plotter', () => {
  it('draws sin(x) at once and names it in the legend', async () => {
    render(<PlotMode />);
    await waitFor(() => expect(d('f').length).toBeGreaterThan(100));
    expect(d('f').startsWith('M')).toBe(true);
    expect(screen.getByRole('list', { name: s.legend })).toHaveTextContent('f(x) = sin(x)');
    expect(screen.getByRole('img', { name: /x/ })).toBeVisible();
    expect(line('g')).toBeNull();
  });

  it('draws a second function with its own line and legend entry', async () => {
    const user = userEvent.setup();
    render(<PlotMode />);
    await user.type(screen.getByLabelText('g(x)'), 'x^2 / 10');
    await waitFor(() => expect(d('g').length).toBeGreaterThan(100));
    expect(d('g')).not.toBe(d('f'));
    expect(screen.getByRole('list', { name: s.legend })).toHaveTextContent('g(x) = x^2 / 10');
  });

  it('says what is wrong with a function, next to its field, and keeps the others', async () => {
    const user = userEvent.setup();
    render(<PlotMode />);
    await user.type(screen.getByLabelText('g(x)'), 'foo(x');
    expect(await screen.findByText(t.tools.calc.errors.syntax!)).toBeVisible();
    await user.clear(screen.getByLabelText('g(x)'));
    await user.type(screen.getByLabelText('g(x)'), 'y + 1');
    expect(await screen.findByText(t.tools.calc.errors.unknown!)).toBeVisible();
    expect(d('f').length).toBeGreaterThan(100);
  });

  it('breaks the line at a pole', async () => {
    const user = userEvent.setup();
    render(<PlotMode />);
    await user.clear(screen.getByLabelText('f(x)'));
    await user.type(screen.getByLabelText('f(x)'), '1 / x');
    await waitFor(() => expect(d('f').match(/M/g)?.length ?? 0).toBeGreaterThanOrEqual(2));
  });

  it('says so when the function has no values in the range', async () => {
    const user = userEvent.setup();
    render(<PlotMode />);
    await user.clear(screen.getByLabelText('f(x)'));
    await user.type(screen.getByLabelText('f(x)'), 'sqrt(x)');
    fireEvent.change(screen.getByLabelText(s.xFrom), { target: { value: '-10' } });
    fireEvent.change(screen.getByLabelText(s.xTo), { target: { value: '-1' } });
    expect(await screen.findByText(s.noValues)).toBeVisible();
  });

  it('asks for a function when there is none', async () => {
    const user = userEvent.setup();
    render(<PlotMode />);
    await user.clear(screen.getByLabelText('f(x)'));
    expect(await screen.findByText(s.empty)).toBeVisible();
  });

  it('zooms and moves with the buttons, and resets', async () => {
    const user = userEvent.setup();
    render(<PlotMode />);
    await screen.findByTestId('plot-line-f');
    await user.click(screen.getByRole('button', { name: s.zoomIn }));
    expect(screen.getByLabelText(s.xFrom)).toHaveValue('-8');
    expect(screen.getByLabelText(s.xTo)).toHaveValue('8');
    await user.click(screen.getByRole('button', { name: s.right }));
    expect(screen.getByLabelText(s.xFrom)).toHaveValue('-4');
    await user.click(screen.getByRole('button', { name: s.zoomOut }));
    await user.click(screen.getByRole('button', { name: s.reset }));
    expect(screen.getByLabelText(s.xFrom)).toHaveValue('-10');
    expect(screen.getByLabelText(s.xTo)).toHaveValue('10');
    expect(screen.getByLabelText(s.yAuto)).toBeChecked();
  });

  it('moving up switches the y range to manual from the current view', async () => {
    const user = userEvent.setup();
    render(<PlotMode />);
    await screen.findByTestId('plot-line-f');
    expect(screen.queryByLabelText(s.yFrom)).toBeNull();
    await user.click(screen.getByRole('button', { name: s.up }));
    expect(screen.getByLabelText(s.yAuto)).not.toBeChecked();
    expect(screen.getByLabelText(s.yFrom)).toBeVisible();
  });

  it('is operated with the keyboard on the graph', async () => {
    const user = userEvent.setup();
    render(<PlotMode />);
    const graph = await screen.findByTestId('plot');
    graph.focus();
    expect(graph).toHaveFocus();
    await user.keyboard('+');
    expect(screen.getByLabelText(s.xFrom)).toHaveValue('-8');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByLabelText(s.xFrom)).toHaveValue('-6,4');
    await user.keyboard('0');
    expect(screen.getByLabelText(s.xFrom)).toHaveValue('-10');
  });

  it('refuses a range that makes no sense instead of drawing something', async () => {
    render(<PlotMode />);
    fireEvent.change(screen.getByLabelText(s.xFrom), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(s.xTo), { target: { value: '1' } });
    expect(await screen.findByRole('alert')).toHaveTextContent(s.badRange);
  });

  it('plots trigonometry in radians by default and in degrees on request', async () => {
    const user = userEvent.setup();
    render(<PlotMode />);
    await waitFor(() => expect(d('f').length).toBeGreaterThan(100));
    const rad = d('f');
    await user.click(screen.getByRole('button', { name: t.tools.calc.pro.deg }));
    await waitFor(() => expect(d('f')).not.toBe(rad));
  });
});
