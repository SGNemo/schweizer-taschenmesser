// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { db } from '@/core/db/db';
import { readSetupState, SETUP_STATE_KEY, markStepDone } from '@/core/setup/state';
import type { SetupStepDef, SetupStepProps } from '@/core/setup/types';
import { t } from '@/strings';
import { SetupWizard } from './SetupWizard';
import { WelcomeCard } from './WelcomeCard';

const s = t.setup;
const commits: Record<string, Mock<() => Promise<void>>> = {};

function makeStep(id: string, order: number, commit?: () => Promise<void>): SetupStepDef {
  commits[id] = vi.fn<() => Promise<void>>(commit ?? (async () => {}));
  function Body({ registerCommit }: SetupStepProps) {
    useEffect(() => {
      registerCommit(commits[id]!);
      return () => registerCommit(null);
    }, [registerCommit]);
    return <p>{`Inhalt ${id}`}</p>;
  }
  return {
    id,
    title: `Schritt ${id}`,
    description: `Beschreibung ${id}`,
    order,
    since: 1,
    component: async () => ({ default: Body }),
  };
}

let steps: SetupStepDef[];
beforeEach(async () => {
  await db.table('_meta').delete(SETUP_STATE_KEY);
  steps = [makeStep('a', 1), makeStep('b', 2), makeStep('c', 3)];
});

async function open(props: Partial<React.ComponentProps<typeof SetupWizard>> = {}) {
  const onClose = vi.fn();
  render(<SetupWizard steps={steps} onClose={onClose} {...props} />);
  return { onClose, user: userEvent.setup() };
}

describe('setup wizard', () => {
  it('saves each step on "Weiter" and shows a summary at the end', async () => {
    const { user, onClose } = await open();
    expect(await screen.findByText('Inhalt a')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: s.next }));
    expect(await screen.findByText('Inhalt b')).toBeInTheDocument();
    expect(commits.a).toHaveBeenCalledTimes(1);
    expect((await readSetupState())?.doneSteps).toEqual(['a']);
    await user.click(screen.getByRole('button', { name: s.skip }));
    await user.click(await screen.findByRole('button', { name: s.finish }));
    expect(await screen.findByTestId('setup-summary')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: s.finish }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await readSetupState()).toMatchObject({
      status: 'completed',
      doneSteps: ['a', 'c'],
      skippedSteps: ['b'],
    });
    expect(commits.b).not.toHaveBeenCalled();
  });

  it('cancelling drops only the current step: earlier ones stay, this one is not written', async () => {
    const { user, onClose } = await open();
    await screen.findByText('Inhalt a');
    await user.click(screen.getByRole('button', { name: s.next }));
    await screen.findByText('Inhalt b');
    await user.click(screen.getByRole('button', { name: t.actions.close }));
    expect(await screen.findByTestId('setup-confirm')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: s.later }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(commits.b).not.toHaveBeenCalled();
    expect(await readSetupState()).toMatchObject({ status: 'inProgress', doneSteps: ['a'] });
  });

  it('"Einrichtung beenden" dismisses but keeps the progress for the checklist', async () => {
    const { user, onClose } = await open();
    await screen.findByText('Inhalt a');
    await user.click(screen.getByRole('button', { name: s.next }));
    await screen.findByText('Inhalt b');
    await user.click(screen.getByRole('button', { name: t.actions.close }));
    await user.click(await screen.findByRole('button', { name: s.end }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await readSetupState()).toMatchObject({ status: 'dismissed', doneSteps: ['a'] });
  });

  it('"Weiter einrichten" returns to the step; Esc in the confirmation does the same', async () => {
    const { user, onClose } = await open();
    await screen.findByText('Inhalt a');
    fireEvent(document.querySelector('dialog')!, new Event('cancel', { cancelable: true }));
    expect(await screen.findByTestId('setup-confirm')).toBeInTheDocument();
    fireEvent(document.querySelector('dialog')!, new Event('cancel', { cancelable: true }));
    expect(await screen.findByText('Inhalt a')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.actions.close }));
    await user.click(await screen.findByRole('button', { name: s.keepGoing }));
    expect(await screen.findByText('Inhalt a')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(await readSetupState()).toBeNull();
  });

  it('the Android back gesture opens the confirmation instead of leaving', async () => {
    await open();
    await screen.findByText('Inhalt a');
    act(() => window.history.back());
    expect(await screen.findByTestId('setup-confirm')).toBeInTheDocument();
  });

  it('a failing step is not marked done and shows a generic message', async () => {
    steps = [makeStep('a', 1, async () => Promise.reject(new Error('token=sk-invented')))];
    const { user } = await open();
    await screen.findByText('Inhalt a');
    await user.click(screen.getByRole('button', { name: s.finish }));
    expect(await screen.findByRole('alert')).toHaveTextContent(s.commitFailed);
    expect(screen.queryByText(/sk-invented/)).toBeNull();
    expect(await readSetupState()).toBeNull();
  });

  it('offers to resume where the user stopped, or to look at everything again', async () => {
    await markStepDone('a');
    const { user } = await open();
    await user.click(await screen.findByRole('button', { name: s.resumeAt('Schritt b') }));
    expect(await screen.findByText('Inhalt b')).toBeInTheDocument();
  });

  it('"Von vorn" shows all steps again and changes no progress', async () => {
    await markStepDone('a');
    const { user } = await open();
    await user.click(await screen.findByRole('button', { name: s.fromStart }));
    expect(await screen.findByText('Inhalt a')).toBeInTheDocument();
    expect((await readSetupState())?.doneSteps).toEqual(['a']);
  });

  it('opens directly at a step from the checklist', async () => {
    await markStepDone('a');
    await open({ stepId: 'c' });
    expect(await screen.findByText('Inhalt c')).toBeInTheDocument();
  });

  it('skips steps whose condition is false', async () => {
    steps = [makeStep('a', 1), { ...makeStep('b', 2), when: () => false }, makeStep('c', 3)];
    const { user } = await open();
    await screen.findByText('Inhalt a');
    await user.click(screen.getByRole('button', { name: s.next }));
    expect(await screen.findByText('Inhalt c')).toBeInTheDocument();
  });
});

describe('welcome card', () => {
  it('"Später" dismisses for good and the card does not come back', async () => {
    await db.table('_meta').put({
      key: SETUP_STATE_KEY,
      value: {
        status: 'notStarted',
        doneSteps: [],
        skippedSteps: [],
        version: 1,
        checklistHidden: false,
      },
    });
    const user = userEvent.setup();
    const { unmount } = render(<WelcomeCard />);
    await user.click(await screen.findByRole('button', { name: s.welcomeLater }));
    await waitFor(() => expect(screen.queryByTestId('setup-welcome')).toBeNull());
    expect((await readSetupState())?.status).toBe('dismissed');
    unmount();
    render(<WelcomeCard />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('setup-welcome')).toBeNull();
  });

  it('is not offered on an existing installation (dismissed)', async () => {
    await db.table('_meta').put({
      key: SETUP_STATE_KEY,
      value: {
        status: 'dismissed',
        doneSteps: [],
        skippedSteps: [],
        version: 1,
        checklistHidden: false,
      },
    });
    render(<WelcomeCard />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('setup-welcome')).toBeNull();
  });
});
