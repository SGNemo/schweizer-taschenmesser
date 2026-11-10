// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { setSettings, settingsRepo } from '@/core/settings/settings';
import { setNow } from '@/core/time/now';
import { mealRepo, sessionRepo } from '../repo';
import FitnessPage from '../routes/FitnessPage';

/** The settings read answers later than the data: the order a busy device can produce. */
function slowSettings(ms = 60) {
  const get = settingsRepo.get.bind(settingsRepo);
  vi.spyOn(settingsRepo, 'get').mockImplementation(async (id) => {
    const row = await get(id);
    await new Promise((r) => setTimeout(r, ms));
    return row;
  });
}

/** Renders the page and collects every text the document showed on the way. */
function watch(url: string) {
  const seen: string[] = [];
  const observer = new MutationObserver(() => seen.push(document.body.textContent ?? ''));
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  render(
    <MemoryRouter initialEntries={[url]}>
      <FitnessPage />
    </MemoryRouter>,
  );
  return {
    shown: (text: string) => {
      observer.disconnect();
      return seen.filter((s) => s.includes(text)).length > 0;
    },
  };
}

describe('fitness page while the settings are still loading', () => {
  beforeEach(async () => {
    setNow(() => new Date(2026, 10, 8, 12, 0).getTime());
    await db.table('fitness_session').clear();
    await db.table('fitness_meal').clear();
    await db.table('_settings').clear();
    await sessionRepo.create({ date: '2026-11-06', exercises: [{ name: 'Kniebeuge' }] });
    await mealRepo.create({ date: '2026-11-08', text: 'Brot', kcal: 400 });
  });
  afterEach(() => {
    setNow();
    vi.restoreAllMocks();
  });

  it('never shows the food tab or view when calorie tracking is off', async () => {
    await setSettings('module.fitness', { nutrition: false });
    slowSettings();
    const page = watch('/fitness?view=food');
    expect(
      await screen.findByRole('button', { name: 'Training', pressed: true }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Essen' })).toBeNull();
    expect(page.shown('Essen')).toBe(false);
    expect(page.shown('Brot')).toBe(false);
  });

  it('opens the food view directly when calorie tracking is on', async () => {
    slowSettings();
    const page = watch('/fitness?view=food');
    expect(await screen.findByRole('button', { name: 'Essen', pressed: true })).toBeInTheDocument();
    expect(await screen.findByText('Brot')).toBeInTheDocument();
    expect(page.shown('Kniebeuge')).toBe(false);
  });
});
