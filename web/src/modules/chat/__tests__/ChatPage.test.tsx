// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LOCAL_MODELS } from '@/core/ai/local/catalogue';
import { switchAiOff, switchAiOn } from '@/core/ai/switch';
import { writeLocalPrefs } from '@/core/ai/local/prefs';
import { db } from '@/core/db/db';
import { setPlatform } from '@/core/platform';
import { createFakeLocalModel } from '@/core/platform/fakeLocalModel';
import { createWebPlatform } from '@/core/platform/web';
import { t } from '@/strings';
import { messageRepo, threadRepo } from '../repo';
import ChatPage from '../routes/ChatPage';

const c = t.chat;
const entry = LOCAL_MODELS[0]!;

beforeEach(async () => {
  for (const name of ['chat_thread', 'chat_message', '_aiUsage', '_settings'])
    await db.table(name).clear();
  localStorage.clear();
  setPlatform({
    ...createWebPlatform(),
    localModel: createFakeLocalModel({
      models: [{ file: entry.file, bytes: entry.bytes }],
      answer: () => 'Das ist **eine** Antwort.',
    }),
  });
  writeLocalPrefs({ file: entry.file, first: true, autoLoad: true });
});
afterEach(() => setPlatform(undefined));

const view = (path = '/chat') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ChatPage />
    </MemoryRouter>,
  );

describe('ChatPage', () => {
  it('starts with an empty state and a way to begin', async () => {
    view();
    expect(await screen.findByText(c.empty)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: c.emptyAction })).toBeInTheDocument();
  });

  it('shows a calm notice instead of the chat while "KI abschalten" is on', async () => {
    await threadRepo.create({
      title: 'Alt',
      autoTitle: false,
      pinned: false,
      archived: false,
      engine: 'local',
      contextModules: [],
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
    });
    await switchAiOff('device');
    try {
      view();
      expect(await screen.findByText(c.aiOff)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: c.newChat })).toBeNull();
    } finally {
      await switchAiOn();
    }
  });

  it('creates a chat, asks the local model and shows the formatted answer', async () => {
    const user = userEvent.setup();
    await threadRepo.create({
      title: 'Test',
      autoTitle: true,
      pinned: false,
      archived: false,
      engine: 'local',
      contextModules: [],
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
    });
    view();
    await user.click(await screen.findByRole('button', { name: /Test/ }));
    await user.type(await screen.findByPlaceholderText(c.placeholder), 'Hallo Welt');
    await user.click(screen.getByRole('button', { name: c.send }));
    const answer = await screen.findByTestId('msg-assistant');
    expect(within(answer).getByText('eine').tagName).toBe('STRONG');
    expect(within(answer).getByText(c.stageLocal)).toBeInTheDocument();
    await waitFor(async () => expect((await messageRepo.active().toArray()).length).toBe(2));
  });

  it('shows a clear message instead of a reply when no engine is set up, and keeps the question', async () => {
    const user = userEvent.setup();
    const thread = await threadRepo.create({
      title: 'Cloud',
      autoTitle: true,
      pinned: false,
      archived: false,
      engine: 'router',
      contextModules: [],
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
    });
    view(`/chat?t=${thread.id}`);
    await user.type(await screen.findByPlaceholderText(c.placeholder), 'Frage ohne Anbieter');
    await user.click(screen.getByRole('button', { name: c.send }));
    expect(await screen.findByTestId('chat-error')).toHaveTextContent(c.errors['no-engine']!);
    expect(await screen.findByText('Frage ohne Anbieter')).toBeInTheDocument();
  });

  it('deletes a chat only after confirmation', async () => {
    const user = userEvent.setup();
    const thread = await threadRepo.create({
      title: 'Weg damit',
      autoTitle: false,
      pinned: false,
      archived: false,
      engine: 'router',
      contextModules: [],
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
    });
    view(`/chat?t=${thread.id}`);
    await user.click(await screen.findByRole('button', { name: c.delete }));
    expect(await threadRepo.get(thread.id)).toBeDefined();
    await user.click(await screen.findByTestId('chat-delete-confirm'));
    await waitFor(async () => expect(await threadRepo.get(thread.id)).toBeUndefined());
  });
});
