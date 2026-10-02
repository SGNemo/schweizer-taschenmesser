import { expect, test, type Page, type Route } from '@playwright/test';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

/** Rows go straight into IndexedDB (read-only test data; the assistant reads fresh on every question). */
async function seed(page: Page) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(async () => {
    const env = (data: Record<string, unknown>, id: string) => ({
      ...data,
      id,
      createdAt: 1,
      updatedAt: 1,
      deviceId: 'e2e',
      deletedAt: null,
      _f: {},
    });
    const tables: Record<string, Record<string, unknown>[]> = {
      todos_list: [{ id: 'inbox', name: 'Eingang', order: 0 }],
      todos_task: [
        {
          id: 't1',
          listId: 'inbox',
          title: 'Milch kaufen',
          done: false,
          priority: 0,
          order: 0,
          dueDate: '2026-09-29',
        },
        {
          id: 't2',
          listId: 'inbox',
          title: 'Steuererklärung Geheimfirma',
          done: false,
          priority: 2,
          order: 1,
          dueDate: '2026-10-05',
        },
      ],
      invoices_invoice: [
        {
          id: 'i1',
          payee: 'Stadtwerke Musterstadt',
          amountMinor: 8990,
          dueDate: '2026-10-05',
          status: 'open',
        },
        { id: 'i2', payee: 'Vodafone', amountMinor: 3999, dueDate: '2026-09-25', status: 'open' },
        {
          id: 'i3',
          payee: 'Telekom',
          amountMinor: 2500,
          dueDate: '2026-09-10',
          status: 'paid',
          paidAt: '2026-09-11',
        },
      ],
      subscriptions_subscription: [
        {
          id: 's1',
          name: 'Netflix',
          amountMinor: 1299,
          startDate: '2026-09-15',
          recurrence: { freq: 'monthly', interval: 1 },
          active: true,
        },
      ],
      finance_account: [
        { id: 'acc-main', name: 'Girokonto', openingBalanceMinor: 100000, order: 0 },
      ],
      finance_transaction: [
        {
          id: 'x1',
          accountId: 'acc-main',
          kind: 'income',
          amountMinor: 250000,
          date: '2026-09-01',
          payee: 'Arbeitgeber GmbH',
        },
        {
          id: 'x2',
          accountId: 'acc-main',
          kind: 'expense',
          amountMinor: 4500,
          date: '2026-09-20',
          payee: 'Supermarkt',
        },
      ],
    };
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('taschenmesser');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const names = Object.keys(tables);
        const tx = db.transaction(names, 'readwrite');
        for (const name of names) {
          for (const { id, ...rest } of tables[name]!)
            tx.objectStore(name).put(env(rest, id as string));
        }
        // Finance seeds itself once; mark that as done so the fixtures stay the only data.
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
}

async function openPalette(page: Page) {
  await page.locator('header button', { hasText: 'Suchen' }).click();
  return page.getByRole('combobox');
}

async function ask(page: Page, question: string) {
  const box = await openPalette(page);
  await box.fill(question);
  await box.press('Enter');
  await expect(page.getByTestId('ai-answer')).toBeVisible();
}

async function countRows(page: Page, table: string): Promise<number> {
  return page.evaluate(
    (name) =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction(name).objectStore(name).getAll();
          req.onsuccess = () => {
            db.close();
            resolve(
              (req.result as { deletedAt: number | null }[]).filter((r) => r.deletedAt === null)
                .length,
            );
          };
          req.onerror = () => reject(req.error);
        };
      }),
    table,
  );
}

test.describe('KI-Suche Stufe 1 (lokal, 0 Token)', () => {
  test('answers common German questions without any network call', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith('http://localhost')) external.push(r.url());
    });
    await seed(page);

    await ask(page, 'Was steht heute an?');
    await expect(page.getByTestId('ai-answer').getByText('Milch kaufen')).toBeVisible();
    await expect(page.getByTestId('ai-tier')).toHaveText('Lokal · 0 Token');
    await page.keyboard.press('Escape');

    await ask(page, 'offene Rechnungen');
    const answer = page.getByTestId('ai-answer');
    await expect(answer.getByText('Vodafone')).toBeVisible();
    await expect(answer.getByText('Stadtwerke Musterstadt')).toBeVisible();
    await expect(answer.getByText('Telekom')).toHaveCount(0); // paid
    await page.keyboard.press('Escape');

    await ask(page, 'Kontostand');
    await expect(page.getByTestId('ai-answer').getByText('3.455,00 €').first()).toBeVisible();
    await page.keyboard.press('Escape');

    await ask(page, 'Was kosten meine Abos?');
    await expect(page.getByTestId('ai-answer').getByText('12,99 €').first()).toBeVisible();
    await page.keyboard.press('Escape');

    await ask(page, 'Wie viel muss ich noch bezahlen?');
    await expect(page.getByTestId('ai-answer').getByText('129,89 €').first()).toBeVisible();

    expect(external).toEqual([]);
  });

  test('opens the module from an answer', async ({ page }) => {
    await seed(page);
    await ask(page, 'offene Rechnungen');
    await page
      .getByTestId('ai-answer')
      .getByRole('button', { name: /Vodafone/ })
      .click();
    await expect(page).toHaveURL(/\/invoices$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('shows live full text hits while typing', async ({ page }) => {
    await seed(page);
    const box = await openPalette(page);
    await box.fill('stadtw');
    const hit = page.getByRole('option', { name: /Stadtwerke Musterstadt/ });
    await expect(hit).toBeVisible();
    await hit.click();
    await expect(page).toHaveURL(/\/invoices$/);
  });

  test('complex questions without a model fall back to search and explain how to set one up', async ({
    page,
  }) => {
    await seed(page);
    await ask(page, 'Wann muss ich die Steuererklärung Geheimfirma abgeben?');
    await expect(
      page.getByTestId('ai-answer').getByRole('button', { name: /Steuererklärung Geheimfirma/ }),
    ).toBeVisible();
    await expect(page.getByTestId('ai-answer')).toContainText('KI-Assistent');
  });
});

/* ---------- Stufe 2 with a mocked Anthropic API ---------- */

const API = 'https://api.anthropic.com/v1/messages';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
};

interface Mock {
  requests: { headers: Record<string, string>; body: Record<string, unknown> }[];
}

async function mockClaude(
  page: Page,
  respond: (n: number) => { status?: number; body: unknown },
): Promise<Mock> {
  const mock: Mock = { requests: [] };
  await page.route(API, async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    mock.requests.push({
      headers: req.headers(),
      body: req.postDataJSON() as Record<string, unknown>,
    });
    const { status = 200, body } = respond(mock.requests.length);
    return route.fulfill({
      status,
      headers: { ...CORS, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  });
  return mock;
}

const toolUse = (
  name: string,
  input: unknown,
  usage = { input_tokens: 412, output_tokens: 23 },
) => ({
  id: 'msg_e2e',
  type: 'message',
  role: 'assistant',
  model: 'claude-haiku-4-5-20251001',
  stop_reason: 'tool_use',
  stop_sequence: null,
  content: [{ type: 'tool_use', id: 'tu_1', name, input }],
  usage,
});

/** Adds a provider from its preset in the settings; returns its card. */
async function addProvider(page: Page, presetLabel: string, id: string, key: string) {
  await page.goto('/settings/ki');
  const section = page.locator('section[aria-labelledby="ai"]');
  await section.getByLabel('Anbieter hinzufügen').selectOption({ label: presetLabel });
  const card = section.getByTestId(`provider-${id}`);
  await card.getByLabel('API-Schlüssel').fill(key);
  await card.getByRole('button', { name: 'Speichern' }).click();
  await expect(card.getByText('Gespeichert.')).toBeVisible();
  return card;
}

async function configureClaude(page: Page, key = 'sk-ant-e2e-key') {
  await addProvider(page, 'Claude (Anthropic)', 'anthropic', key);
}

const QUESTION = 'Wie viel habe ich im September für Lebensmittel ausgegeben?';

test.describe('KI-Assistent Stufe 2 (Claude, gemockt)', () => {
  test('sends only question, date and schemas; caches the query; counts tokens', async ({
    page,
  }) => {
    await seed(page);
    const mock = await mockClaude(page, () => ({
      body: toolUse('run_query', {
        module: 'finance',
        collection: 'transaction',
        filters: [{ field: 'kind', op: 'eq', value: 'expense' }],
        range: { relative: 'this_month' },
        aggregate: 'sum:amountMinor',
      }),
    }));
    await configureClaude(page);
    await page.goto('/');

    await ask(page, QUESTION);
    await expect(page.getByTestId('ai-aggregate')).toHaveText('45,00 €');
    await expect(page.getByTestId('ai-tier')).toHaveText('KI · 412 + 23 Token');

    // Privacy: the request carries the key header, the date, the question and schemas – no data.
    expect(mock.requests).toHaveLength(1);
    const sent = mock.requests[0]!;
    expect(sent.headers['x-api-key']).toBe('sk-ant-e2e-key');
    expect(sent.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    const payload = JSON.stringify(sent.body);
    expect(payload).toContain('Heute: 2026-09-29 (Dienstag)');
    expect(payload).toContain(QUESTION);
    expect(payload).toContain('invoice[Rechnung]');
    for (const secret of [
      'Stadtwerke',
      'Vodafone',
      'Telekom',
      'Geheimfirma',
      'Supermarkt',
      'Arbeitgeber',
      'Netflix',
      '8990',
    ]) {
      expect(payload).not.toContain(secret);
    }
    expect(payload).not.toContain('sk-ant-e2e-key');

    // Same question again: answered from the cache, no second request.
    await page.keyboard.press('Escape');
    await ask(page, QUESTION.toLowerCase());
    await expect(page.getByTestId('ai-aggregate')).toHaveText('45,00 €');
    await expect(page.getByTestId('ai-tier')).toHaveText('Aus dem Cache · 0 Token');
    expect(mock.requests).toHaveLength(1);

    // Usage is accounted in the settings.
    await page.goto('/settings/ki');
    const usage = page.getByTestId('ai-usage');
    await expect(usage).toContainText('1 KI-Anfrage');
    await expect(usage).toContainText('1 Antwort aus dem Cache');
    await expect(usage).toContainText('412 Token gesendet, 23 empfangen');
    await page.getByRole('button', { name: 'Zähler zurücksetzen' }).click();
    await expect(page.getByText('Noch keine KI-Anfragen.')).toBeVisible();
  });

  test('creating an entry needs a confirmation', async ({ page }) => {
    await seed(page);
    await mockClaude(page, () => ({
      body: toolUse('create_entry', {
        module: 'calendar',
        collection: 'event',
        data: {
          title: 'Miete überweisen',
          startDate: '2026-10-01',
          startTime: '09:00',
          recurrence: { freq: 'monthly', byMonthDay: 1 },
        },
      }),
    }));
    await configureClaude(page);
    await page.goto('/');

    const before = await countRows(page, 'calendar_event');
    await ask(page, 'Erinnere mich jeden 1. an Miete');
    const preview = page.getByTestId('ai-create-preview');
    await expect(preview).toContainText('Miete überweisen');
    await expect(preview).toContainText('Jeden 1. des Monats');
    expect(await countRows(page, 'calendar_event')).toBe(before);

    // Cancel: nothing is stored.
    await page.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await countRows(page, 'calendar_event')).toBe(before);

    // Ask again (cached intent), confirm: now it is stored and shows up in the module.
    await ask(page, 'Erinnere mich jeden 1. an Miete');
    await expect(page.getByTestId('ai-tier')).toHaveText('Aus dem Cache · 0 Token');
    await page.getByRole('button', { name: 'Anlegen' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect.poll(() => countRows(page, 'calendar_event')).toBe(before + 1);
    await page.goto('/calendar?view=day&date=2026-10-01');
    await expect(page.getByRole('main').getByText('Miete überweisen').first()).toBeVisible();
  });

  test('shows a friendly message when the key is rejected', async ({ page }) => {
    await seed(page);
    await mockClaude(page, () => ({
      status: 401,
      body: {
        type: 'error',
        error: { type: 'authentication_error', message: 'invalid x-api-key' },
      },
    }));
    await configureClaude(page, 'sk-ant-wrong');
    await page.goto('/');
    await ask(page, QUESTION);
    await expect(page.getByTestId('ai-error')).toContainText('API-Schlüssel wurde abgelehnt');
  });

  test('rejects model output that is not allowed by the schemas', async ({ page }) => {
    await seed(page);
    await mockClaude(page, () => ({
      body: toolUse('run_query', {
        module: 'invoices',
        collection: 'invoice',
        filters: [{ field: 'iban', op: 'eq', value: 'DE00' }],
      }),
    }));
    await configureClaude(page);
    await page.goto('/');
    await ask(page, QUESTION);
    await expect(page.getByTestId('ai-error')).toContainText('nicht sicher zuordnen');
  });
});

/* ---------- several providers: fallback router ---------- */

const GROQ = 'https://api.groq.com/openai/v1/chat/completions';
const OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';

async function mockOpenAi(
  page: Page,
  url: string,
  respond: (n: number) => { status?: number; body: unknown; headers?: Record<string, string> },
): Promise<Mock> {
  const mock: Mock = { requests: [] };
  await page.route(url, async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    mock.requests.push({
      headers: req.headers(),
      body: req.postDataJSON() as Record<string, unknown>,
    });
    const { status = 200, body, headers = {} } = respond(mock.requests.length);
    return route.fulfill({
      status,
      headers: { ...CORS, 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  });
  return mock;
}

const toolCall = (name: string, input: unknown) => ({
  model: 'llama-e2e',
  choices: [
    {
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [
          { id: 'c1', type: 'function', function: { name, arguments: JSON.stringify(input) } },
        ],
      },
    },
  ],
  usage: { prompt_tokens: 380, completion_tokens: 21 },
});

test.describe('KI-Anbieter mit Fallback (gemockt)', () => {
  test('a rate-limited first provider is skipped: the second answers, statistics show it', async ({
    page,
  }) => {
    await seed(page);
    const groq = await mockOpenAi(page, GROQ, () => ({
      status: 429,
      headers: { 'retry-after': '120' },
      body: { error: { message: 'rate limit' } },
    }));
    const openrouter = await mockOpenAi(page, OPENROUTER, () => ({
      body: toolCall('run_query', {
        module: 'finance',
        collection: 'transaction',
        filters: [{ field: 'kind', op: 'eq', value: 'expense' }],
        range: { relative: 'this_month' },
        aggregate: 'sum:amountMinor',
      }),
    }));
    await addProvider(page, 'Groq', 'groq', 'gsk-e2e-groq');
    await addProvider(page, 'OpenRouter (kostenlose Modelle)', 'openrouter', 'sk-or-e2e');
    await page.goto('/');

    await ask(page, QUESTION);
    await expect(page.getByTestId('ai-aggregate')).toHaveText('45,00 €');
    expect(groq.requests).toHaveLength(1);
    expect(openrouter.requests).toHaveLength(1);
    expect(groq.requests[0]!.headers.authorization).toBe('Bearer gsk-e2e-groq');
    expect(openrouter.requests[0]!.headers.authorization).toBe('Bearer sk-or-e2e');

    // Privacy: neither provider got data or the other one's key.
    for (const sent of [groq.requests[0]!, openrouter.requests[0]!]) {
      const payload = JSON.stringify(sent.body);
      expect(payload).toContain(QUESTION);
      expect(payload).toContain('invoice[Rechnung]');
      for (const secret of [
        'Stadtwerke',
        'Vodafone',
        'Geheimfirma',
        'Supermarkt',
        'Netflix',
        'gsk-e2e',
        'sk-or-e2e',
      ]) {
        expect(payload).not.toContain(secret);
      }
    }

    // Asking something else: the paused provider is not contacted again.
    await page.keyboard.press('Escape');
    await ask(page, 'Wie viel habe ich im August für Lebensmittel ausgegeben?');
    expect(groq.requests).toHaveLength(1);
    await expect.poll(() => openrouter.requests.length).toBe(2);

    // Same question again: answered from the cache, whichever provider produced it.
    await page.keyboard.press('Escape');
    await ask(page, QUESTION);
    await expect(page.getByTestId('ai-tier')).toHaveText('Aus dem Cache · 0 Token');
    expect(openrouter.requests).toHaveLength(2);

    // client-side navigation: the pause of a rate-limited provider lives in memory, a reload ends it
    await page.keyboard.press('Escape');
    const box = await openPalette(page);
    await box.fill('Einstellung: KI-Assistent');
    await box.press('Enter');
    await expect(page).toHaveURL(/\/settings\/ki/);
    const section = page.locator('section[aria-labelledby="ai"]');
    await expect(section.getByTestId('stats-groq')).toContainText('0 Anfragen · 1 Fehler');
    await expect(section.getByTestId('stats-openrouter')).toContainText(
      '2 Anfragen · 0 Fehler · 1× als Ersatz eingesprungen',
    );
    await expect(section.getByTestId('provider-groq')).toContainText('Pausiert');
  });

  test('reports when no provider can answer', async ({ page }) => {
    await seed(page);
    await mockOpenAi(page, GROQ, () => ({ status: 500, body: { error: 'down' } }));
    await mockOpenAi(page, OPENROUTER, () => ({ status: 503, body: { error: 'down' } }));
    await addProvider(page, 'Groq', 'groq', 'k1');
    await addProvider(page, 'OpenRouter (kostenlose Modelle)', 'openrouter', 'k2');
    await page.goto('/');
    await ask(page, QUESTION);
    await expect(page.getByTestId('ai-error')).toContainText('Kein KI-Anbieter konnte antworten');
  });

  test('tests a connection from the settings', async ({ page }) => {
    await mockOpenAi(page, GROQ, () => ({ body: { choices: [{ message: { content: 'ok' } }] } }));
    const card = await addProvider(page, 'Groq', 'groq', 'gsk-test');
    await card.getByRole('button', { name: 'Verbindung testen' }).click();
    await expect(card.getByTestId('test-groq')).toContainText('Verbindung funktioniert');
  });

  test('a saved key is not readable in the stored settings', async ({ page }) => {
    await addProvider(page, 'Groq', 'groq', 'gsk-visible-secret');
    const stored = await page.evaluate(
      () =>
        new Promise<string>((resolve, reject) => {
          const open = indexedDB.open('taschenmesser');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const req = db.transaction('_secrets').objectStore('_secrets').getAll();
            req.onsuccess = () => {
              db.close();
              resolve(JSON.stringify(req.result));
            };
          };
        }),
    );
    expect(stored).toContain('secret:ai-key:groq');
    expect(stored).not.toContain('gsk-visible-secret');
  });
});
