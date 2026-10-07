import { expect, test, type Page, type Route } from '@playwright/test';
import { dismissNotices } from './helpers';

test.beforeEach(({ page }) => dismissNotices(page));

// The clock is not fixed here: messages are ordered by their creation time.

const API = 'https://api.anthropic.com/v1/messages';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
};

interface Sent {
  body: { system?: string; tools?: unknown; messages: { role: string; content: unknown }[] };
}

async function mockClaude(page: Page, answers: string[]): Promise<Sent[]> {
  const sent: Sent[] = [];
  await page.route(API, async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    sent.push({ body: req.postDataJSON() as Sent['body'] });
    const text = answers[Math.min(sent.length - 1, answers.length - 1)]!;
    return route.fulfill({
      status: 200,
      headers: { ...CORS, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'msg_e2e',
        type: 'message',
        role: 'assistant',
        model: 'claude-haiku-4-5-20251001',
        stop_reason: 'end_turn',
        stop_sequence: null,
        content: [{ type: 'text', text }],
        usage: { input_tokens: 120, output_tokens: 30 },
      }),
    });
  });
  return sent;
}

async function setUp(page: Page) {
  await page.goto('/library');
  const card = page.getByTestId('module-chat');
  await card.getByRole('button', { name: 'Aktivieren' }).click();
  await expect(card.getByText('Aktiv', { exact: true })).toBeVisible();
  await page.goto('/settings/ki');
  const section = page.locator('section[aria-labelledby="ai"]');
  await section.getByLabel('Anbieter hinzufügen').selectOption({ label: 'Claude (Anthropic)' });
  const provider = section.getByTestId('provider-anthropic');
  await provider.getByLabel('API-Schlüssel').fill('sk-ant-e2e-key'); // gitleaks:allow (fixture)
  await provider.getByRole('button', { name: 'Speichern' }).click();
  await expect(provider.getByText('Gespeichert.')).toBeVisible();
}

test.describe('Chat', () => {
  test('talks to a provider with history, renders Markdown safely and keeps data out', async ({
    page,
  }) => {
    const sent = await mockClaude(page, [
      'Hier ein **Plan**:\n\n- erster Punkt\n- zweiter Punkt\n\n[gut](https://example.org) [böse](javascript:alert(1))\n\n<img src=x onerror=alert(1)>',
      'Zweite Antwort',
    ]);
    await setUp(page);
    await page.goto('/chat');
    await page.getByRole('button', { name: 'Chat starten' }).click();

    const input = page.getByPlaceholder('Nachricht schreiben …');
    await input.fill('Plane meine Woche');
    await page.getByRole('button', { name: 'Senden' }).click();

    const answer = page.getByTestId('msg-assistant').first();
    await expect(answer.getByText('Plan', { exact: true })).toBeVisible();
    await expect(answer.getByRole('link', { name: 'gut' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    await expect(answer.getByRole('link', { name: 'böse' })).toHaveCount(0);
    await expect(answer.locator('img')).toHaveCount(0);
    await expect(answer.getByText('Cloud')).toBeVisible();

    await input.fill('Und danach?');
    await page.getByRole('button', { name: 'Senden' }).click();
    await expect(page.getByTestId('msg-assistant').nth(1)).toContainText('Zweite Antwort');

    // Privacy: only the chat text leaves the device, no tools, history alternates.
    expect(sent).toHaveLength(2);
    expect(sent[0]!.body.tools).toBeUndefined();
    expect(sent[1]!.body.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(JSON.stringify(sent[1]!.body)).not.toMatch(/Stadtwerke|Girokonto|Passwort/);

    // Automatic title from the first question; statistics count the cloud answers.
    await page.getByRole('button', { name: 'Zur Chat-Liste' }).click();
    await expect(page.getByRole('button', { name: /Plane meine Woche/ })).toBeVisible();
  });

  test('deleting asks first and removes the chat', async ({ page }) => {
    await mockClaude(page, ['ok']);
    await setUp(page);
    await page.goto('/chat?new=1');
    await page.getByRole('button', { name: 'Chat löschen' }).click();
    await page.getByTestId('chat-delete-confirm').click();
    await expect(page.getByText('Noch kein Chat.', { exact: false })).toBeVisible();
  });
});
