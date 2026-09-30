import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import {
  completeSetup,
  dismissSetup,
  initialState,
  markStepDone,
  markStepSkipped,
  newSteps,
  pauseSetup,
  readSetupState,
  resumeStep,
  setChecklistHidden,
  SETUP_STATE_KEY,
  stepProgress,
  updateSetupState,
} from './state';
import { SETUP_VERSION } from './types';

beforeEach(async () => {
  await db.table('_meta').delete(SETUP_STATE_KEY);
});

describe('setup state', () => {
  it('is empty until written and starts as notStarted', async () => {
    expect(await readSetupState()).toBeNull();
    expect(initialState()).toMatchObject({ status: 'notStarted', doneSteps: [], skippedSteps: [] });
  });

  it('records a step immediately and moves notStarted to inProgress', async () => {
    const s = await markStepDone('a');
    expect(s).toMatchObject({ status: 'inProgress', doneSteps: ['a'], lastStep: 'a' });
    expect(await readSetupState()).toEqual(s);
  });

  it('done and skipped exclude each other and are idempotent', async () => {
    await markStepSkipped('a');
    await markStepDone('a');
    await markStepDone('a');
    expect(await readSetupState()).toMatchObject({ doneSteps: ['a'], skippedSteps: [] });
    await markStepSkipped('a');
    expect(await readSetupState()).toMatchObject({ doneSteps: [], skippedSteps: ['a'] });
  });

  it('pause keeps progress, dismiss keeps progress, complete finishes', async () => {
    await markStepDone('a');
    expect((await pauseSetup()).status).toBe('inProgress');
    const dismissed = await dismissSetup();
    expect(dismissed).toMatchObject({ status: 'dismissed', doneSteps: ['a'] });
    expect((await completeSetup()).status).toBe('completed');
    // A finished setup is not reopened by a later cancel.
    expect((await dismissSetup()).status).toBe('completed');
    expect((await pauseSetup()).status).toBe('completed');
  });

  it('hides and shows the checklist without touching progress', async () => {
    await markStepDone('a');
    expect(await setChecklistHidden(true)).toMatchObject({
      checklistHidden: true,
      doneSteps: ['a'],
    });
  });

  it('refuses anything but the known fields, so values and secrets cannot slip in', async () => {
    await expect(
      updateSetupState((s) => ({ ...s, apiKey: 'sk-invented' }) as never),
    ).rejects.toThrow();
    expect(await readSetupState()).toBeNull();
  });

  it('never syncs: it lives in the local _meta table only', async () => {
    await markStepDone('a');
    expect(await db.table('_outbox').count()).toBe(0);
    expect(await db.table('_meta').get(SETUP_STATE_KEY)).toBeDefined();
  });

  it('resumes at the first open step and reports progress per step', () => {
    const steps = [
      { id: 'a', since: 1 },
      { id: 'b', since: 1 },
      { id: 'c', since: 1 },
    ];
    const state = { ...initialState(), doneSteps: ['a'], skippedSteps: ['b'] };
    expect(resumeStep(steps, state)?.id).toBe('c');
    expect(stepProgress(state, 'a')).toBe('done');
    expect(stepProgress(state, 'b')).toBe('skipped');
    expect(stepProgress(state, 'c')).toBe('open');
    expect(stepProgress(state, 'c', true)).toBe('done');
  });

  it('offers steps added in a later version without repeating the old ones', () => {
    const steps = [
      { id: 'a', since: 1 },
      { id: 'n', since: SETUP_VERSION + 1 },
    ];
    const state = { ...initialState(), doneSteps: ['a'] };
    expect(newSteps(steps, state).map((s) => s.id)).toEqual(['n']);
    expect(newSteps(steps, { ...state, version: SETUP_VERSION + 1 })).toEqual([]);
  });
});
