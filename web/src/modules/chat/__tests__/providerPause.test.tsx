// @vitest-environment jsdom
/**
 * AI1 (launch review 2026-11): when the provider a chat belongs to is paused, the chat says so
 * calmly and offers "Anderen Anbieter wählen" – it never switches by itself. Answers name their
 * provider.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAiConfig, entryFromPreset, saveAiConfig } from '@/core/ai/config';
import type * as ConfigModule from '@/core/ai/config';
import { AiError, type CompletionRequest } from '@/core/ai/providers/types';
import { switchAiOn } from '@/core/ai/switch';
import { db } from '@/core/db/db';
import { t } from '@/strings';
import { messagesOf } from '../engine';
import { messageRepo, threadRepo } from '../repo';
import { ThreadView } from '../components/ThreadView';

const seen: CompletionRequest[] = [];
vi.mock('@/core/ai/config', async (importOriginal) => {
  const actual = await importOriginal<typeof ConfigModule>();
  return {
    ...actual,
    // No keys in the test's secret store: offer the configured entries as they are.
    routerEntries: async (config: ConfigModule.AiConfig) =>
      config.providers.map((entry) => ({ entry, key: 'k' })),
    // The real router is tested in routerPin.test.ts; here only what the chat makes of its answer.
    createRouterProvider: async () => ({
      id: 'router',
      model: 'm',
      async complete(req: CompletionRequest) {
        seen.push(req);
        const pinned = req.pin?.providerId;
        if (pinned === 'anthropic') throw new AiError('provider-paused');
        return {
          toolCalls: [],
          text: 'Antwort von zwei',
          usage: { inputTokens: 3, outputTokens: 2 },
          model: 'm',
          providerId: pinned ?? 'anthropic',
          providerLabel: pinned === 'mistral' ? 'Mistral Test' : 'Claude Test',
          providerRef: req.pin?.ref,
        };
      },
    }),
  };
});

const c = t.chat;

beforeEach(async () => {
  for (const name of ['chat_thread', 'chat_message', '_aiUsage', '_settings'])
    await db.table(name).clear();
  seen.length = 0;
  await switchAiOn();
  const a = { ...entryFromPreset('anthropic'), label: 'Claude Test', keySet: true };
  const m = { ...entryFromPreset('mistral'), label: 'Mistral Test', keySet: true };
  const g = { ...entryFromPreset('gemini'), label: 'Gemini Test', keySet: true };
  await saveAiConfig({ ...defaultAiConfig(), providers: [a, m, g] });
});
afterEach(cleanup);

describe('chat: a paused provider', () => {
  it('shows a calm message naming the provider and switches only after the user picks another', async () => {
    const user = userEvent.setup();
    const thread = await threadRepo.create({
      title: 'Daten',
      autoTitle: false,
      pinned: false,
      archived: false,
      engine: 'router',
      contextModules: [],
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      providerId: 'anthropic',
      providerLabel: 'Claude Test',
    });
    render(
      <MemoryRouter>
        <ThreadView threadId={thread.id} onBack={() => {}} />
      </MemoryRouter>,
    );
    await user.type(await screen.findByPlaceholderText(c.placeholder), 'Und weiter?');
    await user.click(screen.getByRole('button', { name: c.send }));

    const alert = await screen.findByTestId('chat-error');
    expect(alert).toHaveTextContent(c.provider.paused('Claude Test'));
    expect(seen).toHaveLength(1); // nothing went anywhere else
    await user.click(within(alert).getByRole('button', { name: c.provider.choose }));

    const dialog = await screen.findByRole('dialog', { name: c.provider.chooseTitle });
    expect(dialog).toHaveTextContent(c.provider.chooseBody);
    // Only the other configured providers are offered; one that may train on inputs says so.
    expect(
      within(dialog)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Mistral Test', c.provider.mayTrain('Gemini Test')]);
    await user.click(within(dialog).getByRole('button', { name: c.provider.chooseConfirm }));

    expect(await screen.findByText(c.stageCloudBy('Mistral Test'))).toBeInTheDocument();
    expect(seen[1]!.pin).toMatchObject({ providerId: 'mistral' });
    expect(seen[1]!.pin?.ref).toMatch(/^[0-9a-f]{8}$/);
    expect(await threadRepo.get(thread.id)).toMatchObject({
      providerId: 'mistral',
      providerLabel: 'Mistral Test',
    });
    const [, answer] = await messagesOf(thread.id);
    expect(answer?.providerLabel).toBe('Mistral Test');
  });
});

describe('chat: an older chat without a pin', () => {
  it('asks which provider it should go to, sends nothing before, and offers no "try again"', async () => {
    const user = userEvent.setup();
    const thread = await threadRepo.create({
      title: 'Alt',
      autoTitle: false,
      pinned: false,
      archived: false,
      engine: 'router',
      contextModules: [],
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
    });
    await messageRepo.create({ threadId: thread.id, role: 'user', content: 'Alt' });
    await messageRepo.create({
      threadId: thread.id,
      role: 'assistant',
      content: 'A',
      stage: 'cloud',
    });
    render(
      <MemoryRouter>
        <ThreadView threadId={thread.id} onBack={() => {}} />
      </MemoryRouter>,
    );
    await user.type(await screen.findByPlaceholderText(c.placeholder), 'Neu');
    await user.click(screen.getByRole('button', { name: c.send }));
    const alert = await screen.findByTestId('chat-error');
    expect(alert).toHaveTextContent(c.provider.missing());
    expect(within(alert).queryByRole('button', { name: c.retry })).toBeNull();
    expect(seen).toHaveLength(0);
    await user.click(within(alert).getByRole('button', { name: c.provider.pick }));
    const dialog = await screen.findByRole('dialog', { name: c.provider.pickTitle });
    // Both configured providers are offered; the one that may train on inputs says so.
    expect(
      within(dialog)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Claude Test', 'Mistral Test', c.provider.mayTrain('Gemini Test')]);
  });
});
