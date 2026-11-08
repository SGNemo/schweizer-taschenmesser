// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { getFocusSettings } from '@/core/settings/focus';
import { CORE_STEPS } from '@/core/setup/steps';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import FocusStep from './FocusStep';

/** Round 5 (demo-a): texts in the setup say literally what is on the screen. */
describe('setup wording is literal', () => {
  it('A03: the first question names every field it shows', () => {
    const q = t.setup.quick.basics;
    expect(q.title).not.toMatch(/darfst/);
    for (const word of ['Sprache', 'Namen', 'Textgröße', t.setup.steps.basics.more])
      expect(q.description).toContain(word);
  });

  it('A06: the profile question says what to do when no profile fits, with the real menu names', () => {
    const d = t.setup.quick.profiles.description;
    expect(d).toContain(t.nav.library);
    expect(d).toContain(t.setup.next);
  });

  it('B08: an open Umzug point reads as a goal, never as already done', async () => {
    const { MIGRATE_ITEMS } = await import('@/core/setup/migrate');
    const m = t.setup.steps.migrate;
    for (const d of MIGRATE_ITEMS) {
      expect(m.goals[d.id]).toBeTruthy();
      expect(m.goals[d.id]).not.toMatch(/importiert/);
    }
  });

  it('the focus step names only buttons that exist in its mode', () => {
    const f = t.setup.steps.focus;
    expect(f.laterQuick).toContain(t.setup.restLater);
    expect(f.laterFull).toContain(t.setup.skip);
    expect(f.preselect).not.toContain(t.setup.skip);
  });

  it('the focus step is a core step between profiles and tools', () => {
    const ids = CORE_STEPS.slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => s.id);
    expect(ids.indexOf('core.focus')).toBe(ids.indexOf('core.profiles') + 1);
  });
});

describe('setup step "Fokus-Hilfen"', () => {
  it('preselects "Ruhig", writes nothing before "Weiter" and exactly the switches afterwards', async () => {
    useUiStore.getState().setMotion('system');
    useUiStore.getState().setToastStay(false);
    useUiStore.getState().setReadAid(false);
    let commit: (() => Promise<void | 'skipped'>) | null = null;
    const can: boolean[] = [];
    render(
      <FocusStep
        ctx={{ modules: {}, platform: 'web', isNative: false }}
        registerCommit={(fn) => {
          commit = fn;
        }}
        setCanContinue={(ok) => can.push(ok)}
      />,
    );
    const s = t.setup.steps.focus;
    expect(await screen.findByRole('switch', { name: s.motion })).toBeChecked();
    expect(screen.getByRole('switch', { name: s.ownReminders })).toBeChecked();
    expect(screen.getByRole('switch', { name: s.noCounts })).toBeChecked();
    expect(screen.getByRole('switch', { name: s.toastStay })).toBeChecked();
    expect(screen.getByRole('switch', { name: s.readAid })).not.toBeChecked();
    for (const k of ['motion', 'ownReminders', 'noCounts', 'toastStay', 'readAid'] as const)
      expect(screen.getByText(s[`${k}Hint`])).toBeInTheDocument();
    // "Weiter" was held until the switches were there.
    expect(can[0]).toBe(false);
    expect(can.at(-1)).toBe(true);
    // Nothing written yet.
    expect(useUiStore.getState().motion).toBe('system');
    await userEvent.setup().click(screen.getByRole('switch', { name: s.readAid }));
    await waitFor(() => expect(commit).not.toBeNull());
    await commit!();
    expect(useUiStore.getState()).toMatchObject({
      motion: 'reduce',
      toastStay: true,
      readAid: true,
    });
    expect(await getFocusSettings()).toMatchObject({
      todoDigest: false,
      staggered: false,
      streaks: false,
      weekReview: false,
    });
  });

  it('council R2 F7: reopened after it was done, it shows the current values, not the preselection', async () => {
    const { markStepDone } = await import('@/core/setup/state');
    await markStepDone('core.focus');
    useUiStore.getState().setMotion('system');
    render(
      <FocusStep
        ctx={{ modules: {}, platform: 'web', isNative: false }}
        registerCommit={() => {}}
        setCanContinue={() => {}}
      />,
    );
    expect(
      await screen.findByRole('switch', { name: t.setup.steps.focus.motion }),
    ).not.toBeChecked();
    expect(screen.getByTestId('setup-focus-preselect')).toHaveTextContent(
      t.setup.steps.focus.preselectDone,
    );
    expect(screen.queryByText(t.setup.steps.focus.preselect, { exact: false })).toBeNull();
  });
});
