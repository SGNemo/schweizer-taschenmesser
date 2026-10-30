// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LOCAL_MODELS } from '@/core/ai/local/catalogue';
import { db } from '@/core/db/db';
import { setPlatform } from '@/core/platform';
import { createFakeLocalModel } from '@/core/platform/fakeLocalModel';
import { createWebPlatform } from '@/core/platform/web';
import type { SetupStepProps } from '@/core/setup/types';
import { t } from '@/strings';
import AiStep from './AiStep';

const entry = LOCAL_MODELS[0]!;
const props: SetupStepProps = {
  ctx: { modules: {}, platform: 'web', isNative: false },
  registerCommit: () => undefined,
  setCanContinue: () => undefined,
};

function install(models: { file: string; bytes: number }[]) {
  setPlatform({
    ...createWebPlatform(),
    localModel: createFakeLocalModel({ models, answer: () => '' }),
    fetch: (async () => Promise.reject(new Error('offline'))) as typeof fetch,
  });
}

beforeEach(async () => {
  for (const n of ['_meta', '_secrets', '_settings']) await db.table(n).clear();
  localStorage.clear();
});
afterEach(() => setPlatform(undefined));

describe('AI setup step: built-in local model', () => {
  it('points to the built-in model while none is downloaded', async () => {
    install([]);
    render(<AiStep {...props} />);
    expect(await screen.findByText(t.setup.steps.ai.localModelHint)).toBeInTheDocument();
  });

  it('stays quiet once a model is downloaded', async () => {
    install([{ file: entry.file, bytes: entry.bytes }]);
    render(<AiStep {...props} />);
    expect(await screen.findByText(t.setup.steps.ai.none)).toBeInTheDocument();
    expect(screen.queryByTestId('setup-local-model-hint')).toBeNull();
  });
});
