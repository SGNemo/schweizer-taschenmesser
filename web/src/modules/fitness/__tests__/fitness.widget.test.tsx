// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { setSettings, settingsRepo } from '@/core/settings/settings';
import { setNow } from '@/core/time/now';
import { mealRepo, sessionRepo } from '../repo';
import FitnessWidget from '../widgets/FitnessWidget';

/** The settings read answers `ms` later than the data: the order a busy device can produce. */
function slowSettings(ms = 60) {
  const get = settingsRepo.get.bind(settingsRepo);
  return vi.spyOn(settingsRepo, 'get').mockImplementation(async (id) => {
    const row = await get(id);
    await new Promise((r) => setTimeout(r, ms));
    return row;
  });
}

const view = () =>
  render(
    <MemoryRouter>
      <FitnessWidget />
    </MemoryRouter>,
  );

describe('fitness widget', () => {
  beforeEach(async () => {
    setNow(() => new Date(2026, 10, 8, 12, 0).getTime());
    await db.table('fitness_session').clear();
    await db.table('fitness_meal').clear();
    await db.table('_settings').clear();
  });
  afterEach(() => {
    setNow();
    vi.restoreAllMocks();
  });

  it('shows an empty state with an action when there is no data', async () => {
    view();
    expect(await screen.findByRole('link', { name: /Einheit eintragen/ })).toHaveAttribute(
      'href',
      '/fitness?new=session',
    );
  });

  it('shows the week and today with a context line', async () => {
    await sessionRepo.create({ date: '2026-11-06', durationMin: 70, exercises: [] });
    await mealRepo.create({ date: '2026-11-08', text: 'Brot', kcal: 1450 });
    await setSettings('module.fitness', { kcalGoal: 2200 });
    view();
    expect(await screen.findByText('1 Einheit · 1 h 10')).toBeInTheDocument();
    expect(await screen.findByText('1.450 kcal von 2.200')).toBeInTheDocument();
  });

  it('says a passed kcal goal in plain words, never as an overrun', async () => {
    await mealRepo.create({ date: '2026-11-08', text: 'Pizza', kcal: 2450 });
    await setSettings('module.fitness', { kcalGoal: 2200 });
    const { container } = view();
    expect(await screen.findByText('2.450 kcal · Ziel 2.200')).toBeInTheDocument();
    expect(container.querySelector('[class*="over"]')).toBeNull();
  });

  it('leaves the kcal row out when calorie tracking is off', async () => {
    await sessionRepo.create({ date: '2026-11-06', exercises: [] });
    await mealRepo.create({ date: '2026-11-08', text: 'Brot', kcal: 400 });
    await setSettings('module.fitness', { nutrition: false });
    view();
    expect(await screen.findByText('1 Einheit')).toBeInTheDocument();
    expect(screen.queryByText(/kcal/)).toBeNull();
  });

  it('never shows the kcal row from defaults while the settings are still loading', async () => {
    await sessionRepo.create({ date: '2026-11-06', exercises: [] });
    await mealRepo.create({ date: '2026-11-08', text: 'Brot', kcal: 400 });
    await setSettings('module.fitness', { nutrition: false });
    slowSettings();
    const seen: string[] = [];
    const observer = new MutationObserver(() => seen.push(document.body.textContent ?? ''));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    view();
    expect(await screen.findByText('1 Einheit')).toBeInTheDocument();
    observer.disconnect();
    expect(seen.filter((text) => text.includes('kcal'))).toEqual([]);
  });
});
