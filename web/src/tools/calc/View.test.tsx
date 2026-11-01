// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { t } from '@/strings';
import CalcTool from './View';
import { session } from './session';

const s = t.tools.calc;
const wrap = () =>
  render(
    <MemoryRouter>
      <CalcTool />
    </MemoryRouter>,
  );
const result = () => screen.getByTestId('calc-result');

beforeEach(() => {
  localStorage.clear();
  session.vars.clear();
});
afterEach(cleanup);

describe('calculator tool', () => {
  it('shows the result live while typing and commits to the history on Enter', async () => {
    const user = userEvent.setup();
    wrap();
    const field = await screen.findByLabelText(s.input);
    await user.type(field, '0,1 + 0,2');
    await waitFor(() => expect(result()).toHaveTextContent('0,3'));
    await user.type(field, '{Enter}');
    expect(await screen.findByRole('button', { name: /0,1 \+ 0,2/ })).toBeVisible();
    expect(JSON.parse(localStorage.getItem('tm-calc-history-2')!)).toEqual([
      { expr: '0,1 + 0,2', result: '0,3' },
    ]);
  });

  it('stays calm about incomplete input and reports errors on Enter', async () => {
    const user = userEvent.setup();
    wrap();
    const field = await screen.findByLabelText(s.input);
    await user.type(field, '2 +');
    expect(screen.queryByRole('alert')).toBeNull();
    await user.type(field, '{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(s.errors.syntax!);
  });

  it('keeps variables and ans between lines', async () => {
    const user = userEvent.setup();
    wrap();
    const field = await screen.findByLabelText(s.input);
    await user.type(field, 'a = 19%{Enter}');
    await waitFor(() => expect(result()).toHaveTextContent('0,19'));
    await user.clear(field);
    await user.type(field, '200 + a{Enter}');
    await waitFor(() => expect(result()).toHaveTextContent('200,19'));
    await user.clear(field);
    await user.type(field, 'ans * 2');
    await waitFor(() => expect(result()).toHaveTextContent('400,38'));
  });

  it('inserts keys at the cursor and clears with Escape', async () => {
    const user = userEvent.setup();
    wrap();
    const field = await screen.findByLabelText<HTMLInputElement>(s.input);
    await user.click(screen.getByRole('button', { name: '(' }));
    await user.click(screen.getByRole('button', { name: ')' }));
    expect(field.value).toBe('()');
    await user.click(field);
    await user.keyboard('{Escape}');
    expect(field.value).toBe('');
  });

  it('searches the history and offers no note button while the notes module is off', async () => {
    localStorage.setItem(
      'tm-calc-history-2',
      JSON.stringify([
        { expr: 'sqrt(2)', result: '1,41' },
        { expr: '2+2', result: '4' },
      ]),
    );
    const user = userEvent.setup();
    wrap();
    await screen.findByLabelText(s.input);
    await user.type(screen.getByLabelText(s.pro.historySearch), 'sqrt');
    expect(screen.getByRole('button', { name: 'sqrt(2)' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '2+2' })).toBeNull();
    await user.clear(screen.getByLabelText(s.pro.historySearch));
    await user.type(screen.getByLabelText(s.pro.historySearch), 'zzz');
    expect(screen.getByText(s.pro.noMatches)).toBeVisible();
    expect(screen.queryByRole('button', { name: s.pro.toNote })).toBeNull();
  });

  it('remembers the last mode and the angle unit', async () => {
    const user = userEvent.setup();
    const first = wrap();
    await user.click(await screen.findByRole('button', { name: s.modes.scientific! }));
    await screen.findByRole('button', { name: s.pro.deg });
    const field = await screen.findByLabelText(s.input);
    await user.click(screen.getByRole('button', { name: s.pro.deg }));
    await user.type(field, 'sin(30)');
    await waitFor(() => expect(result()).toHaveTextContent('0,5'));
    await user.click(screen.getByRole('button', { name: s.pro.rad }));
    await waitFor(() => expect(result()).toHaveTextContent(/^-0,988/));
    first.unmount();
    wrap();
    // The scientific tab is open again (its function keys are there).
    expect(await screen.findByRole('button', { name: 'asin' })).toBeVisible();
  });

  it('converts in programmer mode with word sizes', async () => {
    const user = userEvent.setup();
    wrap();
    await user.click(await screen.findByRole('button', { name: s.modes.programmer! }));
    const field = await screen.findByLabelText(s.pro.programmer.input);
    fireEvent.change(field, { target: { value: '~5' } });
    await user.click(await screen.findByRole('button', { name: '8' }));
    await waitFor(() => expect(screen.getByText('FA')).toBeVisible());
    expect(screen.getByText('-6')).toBeVisible();
    fireEvent.change(field, { target: { value: '300' } });
    await waitFor(() => expect(screen.getByText(s.pro.programmer.overflow)).toBeVisible());
  });

  it('calculates finance and dates', async () => {
    const user = userEvent.setup();
    wrap();
    await user.click(await screen.findByRole('button', { name: s.modes.finance! }));
    await user.selectOptions(await screen.findByLabelText(s.modes.finance!), 'loan');
    await user.type(screen.getByLabelText(s.pro.finance.loan.amount), '10000');
    await user.type(screen.getByLabelText(s.pro.finance.loan.rate), '5');
    await user.type(screen.getByLabelText(s.pro.finance.loan.years), '10');
    expect(await screen.findByText('106,07')).toBeVisible();
    await user.click(screen.getByRole('button', { name: s.modes.date! }));
    await user.click(await screen.findByRole('button', { name: s.pro.date.add }));
    fireEvent.change(screen.getByLabelText(t.tools.dates.start), {
      target: { value: '2026-10-02' },
    });
    await user.selectOptions(screen.getByLabelText(s.pro.date.unit), 'workdays');
    fireEvent.change(screen.getByLabelText(s.pro.date.amount), { target: { value: '1' } });
    await waitFor(() =>
      expect(screen.getByRole('status', { name: t.tools.dates.result })).toHaveTextContent(
        '5. Oktober 2026',
      ),
    );
  });
});
