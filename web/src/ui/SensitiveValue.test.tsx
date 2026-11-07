// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { getHideValues, setHideValues } from '@/core/focus/hideValues';
import { SensitiveValue } from './SensitiveValue';

describe('SensitiveValue', () => {
  beforeEach(async () => {
    await db.table('_meta').clear();
  });

  it('shows the figure when the setting is off (default)', async () => {
    render(<SensitiveValue>1.234,56 €</SensitiveValue>);
    expect(await screen.findByText('1.234,56 €')).toBeTruthy();
    expect(screen.queryByTestId('sensitive-value')).toBeNull();
  });

  it('hides the figure from everyone, names the state and reveals on click', async () => {
    await setHideValues(true);
    render(<SensitiveValue note="2 Konten">1.234,56 €</SensitiveValue>);
    const btn = await screen.findByRole('button', { name: /Ausgeblendet/ });
    expect(screen.queryByText('1.234,56 €')).toBeNull();
    expect(screen.getByText('2 Konten')).toBeTruthy();
    await userEvent.click(btn);
    expect(screen.getByText('1.234,56 €')).toBeTruthy();
  });

  it('persists the setting', async () => {
    expect(await getHideValues()).toBe(false);
    await setHideValues(true);
    expect(await getHideValues()).toBe(true);
    await setHideValues(false);
    expect(await getHideValues()).toBe(false);
  });
});
