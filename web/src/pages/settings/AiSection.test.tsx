// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAiConfig } from '@/core/ai/config';
import { clearCooldown } from '@/core/ai/router';
import { recordUsage } from '@/core/ai/usage';
import { db } from '@/core/db/db';
import { setPlatform } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { t } from '@/strings';
import { AiSection } from './AiSection';

const s = t.ai.settings;

beforeEach(async () => {
  clearCooldown();
  await db.table('_secrets').clear();
  await db.table('_aiUsage').clear();
});
afterEach(() => setPlatform(undefined));

/** The provider card once its form is open (the card renders a moment before it expands). */
async function cardOf(id: string) {
  const card = await screen.findByTestId(`provider-${id}`);
  await within(card).findByLabelText(s.model);
  return card;
}

async function addProvider(label: string) {
  const user = userEvent.setup();
  await user.selectOptions(await screen.findByLabelText(s.addProvider), label);
  return user;
}

describe('AI settings', () => {
  it('starts without providers and explains the local-only mode', async () => {
    render(<AiSection />);
    expect(await screen.findByText(s.noProviders)).toBeInTheDocument();
    expect(screen.getByText(s.privacy)).toBeInTheDocument();
  });

  it('adds a free provider from a preset (with the training notice) and opens its form', async () => {
    render(<AiSection />);
    await addProvider('Groq');
    const card = await cardOf('groq');
    expect(within(card).getByText(s.tiers.free!)).toBeInTheDocument();
    expect(within(card).getByText(s.trainingNotice)).toBeInTheDocument();
    expect(await within(card).findByLabelText(s.model)).toHaveValue('llama-3.3-70b-versatile');
    expect(within(card).getByLabelText(s.baseUrl)).toHaveValue('https://api.groq.com/openai/v1');
    expect(within(card).getByText(s.browserNote)).toBeInTheDocument(); // web build
    expect((await loadAiConfig()).providers.map((p) => p.id)).toEqual(['groq']);
  });

  it('stores the key encrypted, remembers only that one exists, and never shows it again', async () => {
    render(<AiSection />);
    const user = await addProvider('Groq');
    const card = await cardOf('groq');
    await user.type(within(card).getByLabelText(s.apiKey), 'gsk-super-secret');
    await user.click(within(card).getByRole('button', { name: s.save }));
    await waitFor(async () => expect((await loadAiConfig()).providers[0]!.keySet).toBe(true));

    expect(JSON.stringify(await db.table('_secrets').toArray())).not.toContain('gsk-super-secret');
    await waitFor(() => {
      expect(within(card).getByLabelText(s.apiKey)).toHaveValue('');
      expect(within(card).getByText(new RegExp(s.apiKeySet))).toBeInTheDocument();
    });
  });

  it('keeps the providers in priority order: local first, moved with the buttons', async () => {
    render(<AiSection />);
    await addProvider('Claude (Anthropic)');
    await addProvider('Groq');
    await addProvider('Ollama (lokal)');
    await waitFor(async () =>
      expect((await loadAiConfig()).providers.map((p) => p.id)).toEqual([
        'ollama',
        'groq',
        'anthropic',
      ]),
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: s.moveDown('Groq') }));
    await waitFor(async () =>
      expect((await loadAiConfig()).providers.map((p) => p.id)).toEqual([
        'ollama',
        'anthropic',
        'groq',
      ]),
    );
    // the list re-renders after the stored config changed
    await waitFor(() => {
      expect(screen.getByRole('button', { name: s.moveUp('Ollama (lokal)') })).toBeDisabled();
      expect(screen.getByRole('button', { name: s.moveDown('Groq') })).toBeDisabled();
    });
  });

  it('switches a provider off without deleting it', async () => {
    render(<AiSection />);
    const user = await addProvider('Ollama (lokal)');
    const card = await cardOf('ollama');
    await user.click(within(card).getByRole('switch', { name: s.enabled }));
    await waitFor(async () => expect((await loadAiConfig()).providers[0]!.enabled).toBe(false));
  });

  it('saving the form does not undo the on/off switch', async () => {
    render(<AiSection />);
    const user = await addProvider('Ollama (lokal)');
    const card = await cardOf('ollama');
    await user.click(within(card).getByRole('switch', { name: s.enabled }));
    await waitFor(async () => expect((await loadAiConfig()).providers[0]!.enabled).toBe(false));
    await user.click(within(card).getByRole('button', { name: s.save }));
    await waitFor(() => expect(within(card).getByText(s.saved)).toBeInTheDocument());
    expect((await loadAiConfig()).providers[0]!.enabled).toBe(false);
  });

  it('saves limits and prices as numbers (German decimal comma accepted)', async () => {
    render(<AiSection />);
    const user = await addProvider('Mistral');
    const card = await cardOf('mistral');
    const requests = within(card).getByLabelText(s.limitRequests);
    await user.clear(requests);
    await user.type(requests, '40');
    const cost = within(card).getByLabelText(s.limitCost);
    await user.clear(cost);
    await user.type(cost, '1,5');
    const priceIn = within(card).getByLabelText(s.priceIn);
    await user.clear(priceIn);
    await user.type(priceIn, '0,25');
    await user.click(within(card).getByRole('button', { name: s.save }));
    await waitFor(async () => {
      const entry = (await loadAiConfig()).providers[0]!;
      expect(entry.limits).toEqual({ requestsPerDay: 40, costUsdPerMonth: 1.5 });
      expect(entry.price).toMatchObject({ inputPerMTok: 0.25 });
    });
  });

  it('shows statistics per provider from the usage log', async () => {
    render(<AiSection />);
    await addProvider('Groq');
    await recordUsage(
      {
        provider: 'groq',
        model: 'm',
        inputTokens: 700,
        outputTokens: 30,
        cacheHit: false,
        outcome: 'ok',
        viaFallback: true,
        costUsd: 0,
      },
      db,
    );
    await recordUsage(
      {
        provider: 'groq',
        model: 'm',
        inputTokens: 0,
        outputTokens: 0,
        cacheHit: false,
        outcome: 'error',
        errorCode: 'rate-limit',
      },
      db,
    );
    const stats = await screen.findByTestId('stats-groq');
    await waitFor(() => expect(stats).toHaveTextContent(s.stats(1, 1, 1)));
    expect(stats).toHaveTextContent(s.statsTokens(700, 30));
  });

  it('tests the connection with the entered key – success and a rejected key', async () => {
    const calls: RequestInit[] = [];
    let status = 200;
    setPlatform({
      ...createWebPlatform(),
      fetch: vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        calls.push(init ?? {});
        return new Response(
          JSON.stringify(
            status === 200
              ? { choices: [{ message: { content: 'ok' } }] }
              : { error: { message: 'bad key' } },
          ),
          { status, headers: { 'content-type': 'application/json' } },
        );
      }) as typeof fetch,
    });
    render(<AiSection />);
    const user = await addProvider('Groq');
    const card = await cardOf('groq');
    await user.type(within(card).getByLabelText(s.apiKey), 'gsk-typed');
    await user.click(within(card).getByRole('button', { name: s.test }));
    expect(await within(card).findByTestId('test-groq')).toHaveTextContent(
      /Verbindung funktioniert/,
    );
    expect(String((calls[0]!.headers as Record<string, string>).authorization)).toBe(
      'Bearer gsk-typed',
    );
    expect(String(calls[0]!.body)).toContain('ping');

    status = 401;
    await user.click(within(card).getByRole('button', { name: s.test }));
    await waitFor(() =>
      expect(within(card).getByTestId('test-groq')).toHaveTextContent(
        s.testFailed(`${s.errors.auth!} (HTTP 401: bad key)`),
      ),
    );
  });

  it('removes a provider after confirmation, together with its key', async () => {
    render(<AiSection />);
    const user = await addProvider('Groq');
    const card = await cardOf('groq');
    await user.type(within(card).getByLabelText(s.apiKey), 'gsk-x');
    await user.click(within(card).getByRole('button', { name: s.save }));
    await waitFor(async () => expect((await loadAiConfig()).providers[0]!.keySet).toBe(true));
    await user.click(within(card).getByRole('button', { name: s.remove }));
    await user.click(within(card).getByRole('button', { name: s.confirmRemove }));
    await waitFor(async () => expect((await loadAiConfig()).providers).toEqual([]));
    expect(JSON.stringify(await db.table('_secrets').toArray())).not.toContain(
      'secret:ai-key:groq',
    );
  });
});
