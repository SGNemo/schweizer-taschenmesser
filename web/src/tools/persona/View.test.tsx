// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const openUrl = vi.hoisted(() => vi.fn<(url: string) => Promise<void>>(async () => undefined));
vi.mock('@/core/platform', () => ({ getPlatform: () => ({ app: { openUrl } }) }));
const modules = vi.hoisted(() => ({ states: { notes: false } as Record<string, boolean> }));
vi.mock('@/core/modules/activation', async (orig) => ({
  ...(await orig<object>()),
  useModuleStates: () => modules.states,
}));

import { t } from '@/strings';
import PersonaTool from './View';
import { postcodeFits } from './logic';
import { DATA } from './data';

const s = t.tools.persona;

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}
const wrap = () =>
  render(
    <MemoryRouter>
      <PersonaTool />
      <Where />
    </MemoryRouter>,
  );
const rowValue = (label: string): string =>
  (screen.getByText(label, { selector: 'span' }).nextElementSibling as HTMLElement).textContent!;

beforeEach(() => {
  openUrl.mockClear();
  modules.states = { notes: false };
});
afterEach(cleanup);

describe('persona tool', () => {
  it('shows the persona fields and nothing that works like an identity document', async () => {
    wrap();
    await screen.findByTestId('persona-fields');
    for (const label of [
      s.fields.firstName,
      s.fields.lastName,
      s.fields.username,
      s.fields.birth,
      s.fields.street,
      s.fields.postcode,
      s.fields.city,
      s.fields.phone,
      s.fields.password,
    ]) {
      expect(screen.getByText(label, { selector: 'span' })).toBeVisible();
    }
    const all = screen.getByTestId('persona-fields').textContent!;
    expect(all).not.toMatch(/IBAN|BIC|Kreditkarte|Ausweis|Steuer|Sozialversicherung|Führerschein/i);
    expect(screen.queryByText(s.fields.gender, { selector: 'span' })).toBeNull(); // optional, off by default
    expect(screen.queryByText(s.fields.bio, { selector: 'span' })).toBeNull();
  });

  it('says once, calmly, what it is for – and stays away after "Verstanden"', async () => {
    const user = userEvent.setup();
    const first = wrap();
    expect(await screen.findByText(s.notice)).toBeVisible();
    await user.click(screen.getByRole('button', { name: s.noticeOk }));
    await waitFor(() => expect(screen.queryByText(s.notice)).toBeNull());
    first.unmount();
    wrap();
    await screen.findByTestId('persona-fields');
    expect(screen.queryByText(s.notice)).toBeNull();
  });

  it('copies one field, and everything', async () => {
    const user = userEvent.setup();
    wrap();
    await screen.findByTestId('persona-fields');
    const username = rowValue(s.fields.username);
    await user.click(screen.getByRole('button', { name: s.copyField(s.fields.username) }));
    await waitFor(async () => expect(await navigator.clipboard.readText()).toBe(username));
    await user.click(screen.getByRole('button', { name: s.copyAll }));
    let all = '';
    await waitFor(async () => {
      all = await navigator.clipboard.readText();
      expect(all.split('\n')).toHaveLength(9);
    });
    expect(all).toContain(`${s.fields.username}: ${username}`);
    expect(all).toContain(`${s.fields.password}: ${rowValue(s.fields.password)}`);
  });

  it('re-rolls one field and leaves the others', async () => {
    const user = userEvent.setup();
    wrap();
    await screen.findByTestId('persona-fields');
    const before = {
      first: rowValue(s.fields.firstName),
      last: rowValue(s.fields.lastName),
      pw: rowValue(s.fields.password),
    };
    await user.click(screen.getByRole('button', { name: s.rerollField(s.fields.password) }));
    expect(rowValue(s.fields.password)).not.toBe(before.pw);
    expect(rowValue(s.fields.firstName)).toBe(before.first);
    expect(rowValue(s.fields.lastName)).toBe(before.last);
    await user.click(screen.getByRole('button', { name: s.rerollAll }));
    expect(rowValue(s.fields.password)).not.toBe(before.pw);
  });

  it('switches the country: plausible city, postcode and a fitting phone', async () => {
    const user = userEvent.setup();
    wrap();
    await screen.findByTestId('persona-fields');
    await user.selectOptions(screen.getByLabelText(s.country), 'us');
    await waitFor(() => expect(rowValue(s.fields.phone)).toMatch(/^\+1 \d{3} 555 01\d{2}$/));
    expect(postcodeFits('us', rowValue(s.fields.city), rowValue(s.fields.postcode))).toBe(true);
    expect(DATA.us.streets.some((x) => rowValue(s.fields.street).includes(x))).toBe(true);
    await user.selectOptions(screen.getByLabelText(s.country), 'br');
    await waitFor(() => expect(rowValue(s.fields.postcode)).toMatch(/^\d{5}-\d{3}$/));
  });

  it('adds gender and bio only when asked for', async () => {
    const user = userEvent.setup();
    wrap();
    await screen.findByTestId('persona-fields');
    await user.selectOptions(screen.getByLabelText(s.gender), 'f');
    await user.click(screen.getByLabelText(s.bio));
    expect(await screen.findByText(s.fields.gender, { selector: 'span' })).toBeVisible();
    expect(rowValue(s.fields.gender)).toBe(s.genderValues.f);
    await waitFor(() => expect(rowValue(s.fields.bio)).toBeTruthy());
  });

  it('opens the chosen disposable-mail site in the browser and nothing else', async () => {
    const user = userEvent.setup();
    wrap();
    await screen.findByTestId('persona-fields');
    await user.click(screen.getByRole('button', { name: s.mail }));
    expect(openUrl).toHaveBeenLastCalledWith('https://www.guerrillamail.com/');
    await user.selectOptions(screen.getByLabelText(s.mailProvider), 'tenminute');
    await user.click(screen.getByRole('button', { name: s.mail }));
    expect(openUrl).toHaveBeenLastCalledWith('https://10minutemail.com/');
    expect(openUrl).toHaveBeenCalledTimes(2);
    // the choice is remembered
    cleanup();
    wrap();
    await waitFor(() => expect(screen.getByLabelText(s.mailProvider)).toHaveValue('tenminute'));
  });

  it('offers "save as note" only while Notizen is on, and hands over the lines', async () => {
    const user = userEvent.setup();
    const first = wrap();
    await screen.findByTestId('persona-fields');
    expect(screen.queryByRole('button', { name: s.saveNote })).toBeNull();
    first.unmount();
    modules.states = { notes: true };
    wrap();
    await user.click(await screen.findByRole('button', { name: s.saveNote }));
    const where = screen.getByTestId('where').textContent!;
    expect(where.startsWith('/notes?new=1&title=')).toBe(true);
    const params = new URLSearchParams(where.split('?')[1]);
    expect(params.get('title')).toBe(s.noteTitle);
    expect(params.get('text')).toContain(`${s.fields.password}: `);
    expect(screen.getByText(s.noteWarn)).toBeVisible(); // the unencrypted-note warning sits next to the button
  });
});
