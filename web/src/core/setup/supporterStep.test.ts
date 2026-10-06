// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { updateSupporterPrefs } from '@/core/supporter';
import { applicableSteps } from './registry';
import { buildChecklist } from './checklist';
import { initialState } from './state';
import { CORE_STEPS } from './steps';
import { SETUP_VERSION } from './types';

const step = CORE_STEPS.find((s) => s.id === 'core.support')!;
const ctx = { modules: {}, platform: 'web', isNative: false } as const;

beforeEach(async () => {
  await db.table('_settings').clear();
});

describe('optional supporter hint in the setup assistant', () => {
  it('is the very last step and does not bump the setup version', () => {
    expect(Math.max(...CORE_STEPS.map((s) => s.order))).toBe(step.order);
    expect(step.since).toBeLessThanOrEqual(SETUP_VERSION);
  });

  it('is offered until "Nicht mehr zeigen" was used', async () => {
    expect(await applicableSteps([step], ctx)).toHaveLength(1);
    await updateSupporterPrefs({ hideSetupHint: true });
    expect(await applicableSteps([step], ctx)).toHaveLength(0);
  });

  it('never shows up in the dashboard checklist, not even when skipped', () => {
    expect(step.hint).toBe(true);
    const state = { ...initialState('completed'), skippedSteps: [step.id] };
    const list = buildChecklist([step], state);
    expect(list).toEqual({ total: 0, done: 0, open: [] });
  });
});
