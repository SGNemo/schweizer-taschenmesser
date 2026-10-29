import { expect, test, type Page } from '@playwright/test';
import { dismissNotices, ready } from './helpers';

test.beforeEach(({ page }) => dismissNotices(page));

/** A stand-in for the browser's speech recognition: the test says what was "heard". */
async function mockRecognition(page: Page) {
  await page.addInitScript(() => {
    class FakeRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        (window as unknown as { __rec: FakeRecognition }).__rec = this;
        (window as unknown as { __recLang: string }).__recLang = this.lang;
      }
      stop() {
        setTimeout(() => this.onend?.(), 0);
      }
      abort() {
        setTimeout(() => this.onend?.(), 0);
      }
    }
    Object.assign(window, { SpeechRecognition: FakeRecognition });
    (window as unknown as { __say: (t: string) => void }).__say = (text) => {
      const rec = (window as unknown as { __rec: FakeRecognition }).__rec;
      rec.onresult?.({
        resultIndex: 0,
        results: Object.assign([{ isFinal: true, 0: { transcript: text } }], { length: 1 }),
      });
    };
  });
}

async function enableVoice(page: Page) {
  await page.goto('/settings/schnellerfassung');
  const sw = page.getByRole('switch', { name: 'Spracheingabe nutzen' });
  await expect(sw).not.toBeChecked();
  await sw.click();
  // First switch-on explains where audio may go; nothing is on before the answer.
  await expect(page.getByRole('dialog').getByText(/Anbieter/)).toBeVisible();
  await page.getByTestId('voice-notice-confirm').click();
  await expect(sw).toBeChecked();
}

test('off by default: no key reaction and no microphone button', async ({ page }) => {
  await mockRecognition(page);
  await ready(page, '/');
  await page.keyboard.press('F4');
  await expect(page.getByTestId('voice-pill')).toHaveCount(0);
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Suchen' })).toBeVisible();
  await expect(page.getByTestId('voice-mic')).toHaveCount(0);
});

test('where the browser has no speech recognition the switch says so, politely', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.assign(window, { SpeechRecognition: undefined, webkitSpeechRecognition: undefined });
  });
  await page.goto('/settings/schnellerfassung');
  await expect(page.getByTestId('voice-unavailable')).toContainText('Hier nicht verfügbar');
  await expect(page.getByRole('switch', { name: 'Spracheingabe nutzen' })).toBeDisabled();
});

test('the button records, calmly, and the text lands in the input', async ({ page }) => {
  await mockRecognition(page);
  await enableVoice(page);
  await ready(page, '/');
  await page.keyboard.press('Control+k');
  const input = page.getByRole('combobox');
  await input.fill('offene');
  const mic = page.getByTestId('voice-mic');
  await mic.click();
  await expect(mic).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('voice-status')).toContainText('Ich höre zu');
  expect(await page.evaluate(() => (window as unknown as { __recLang: string }).__recLang)).toBe(
    'de-DE',
  );
  // Calm: no animation on the button while listening.
  expect(await mic.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await page.evaluate(() =>
    (window as unknown as { __say: (t: string) => void }).__say('Rechnungen'),
  );
  await mic.click();
  await expect(input).toHaveValue('offene Rechnungen');
  await expect(mic).toHaveAttribute('aria-pressed', 'false');
});

test('F4 works from the page: a tap opens the palette with the text when finished', async ({
  page,
}) => {
  await mockRecognition(page);
  await enableVoice(page);
  await ready(page, '/');
  await page.keyboard.press('F4');
  await expect(page.getByTestId('voice-pill')).toContainText('Ich höre zu');
  await page.evaluate(() =>
    (window as unknown as { __say: (t: string) => void }).__say('Milch kaufen'),
  );
  await page.keyboard.press('F4');
  await expect(page.getByRole('combobox')).toHaveValue('Milch kaufen');
});

test('Esc cancels the recording and keeps what was typed, without closing the palette', async ({
  page,
}) => {
  await mockRecognition(page);
  await enableVoice(page);
  await ready(page, '/');
  await page.keyboard.press('Control+k');
  const input = page.getByRole('combobox');
  await input.fill('Entwurf');
  await page.keyboard.press('F4');
  await expect(page.getByTestId('voice-mic')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() =>
    (window as unknown as { __say: (t: string) => void }).__say('verwerfen'),
  );
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('voice-mic')).toHaveAttribute('aria-pressed', 'false');
  await expect(input).toHaveValue('Entwurf');
  await expect(page.getByRole('dialog', { name: 'Suchen' })).toBeVisible();
});

test('a denied microphone gives a friendly sentence, no error screen', async ({ page }) => {
  await mockRecognition(page);
  await enableVoice(page);
  await ready(page, '/');
  await page.keyboard.press('Control+k');
  await page.getByTestId('voice-mic').click();
  await page.evaluate(() => {
    const rec = (window as unknown as { __rec: { onerror: (e: { error: string }) => void } }).__rec;
    rec.onerror({ error: 'not-allowed' });
  });
  await expect(page.getByTestId('voice-status')).toContainText('Mikrofon ist nicht freigegeben');
  await expect(page.getByRole('combobox')).toBeVisible();
});

test('the shortcut sheet lists the voice key once voice input is on', async ({ page }) => {
  await mockRecognition(page);
  await ready(page, '/');
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Tastenkürzel' })).not.toContainText(
    'Sprechen (halten oder tippen)',
  );
  await page.keyboard.press('Escape');
  await enableVoice(page);
  await ready(page, '/');
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Tastenkürzel' })).toContainText(
    'Sprechen (halten oder tippen)',
  );
});

test('while a key is being recorded, the old voice key does not start a recording', async ({
  page,
}) => {
  await mockRecognition(page);
  await enableVoice(page);
  const record = page.getByTestId('voice-key-record');
  await record.click();
  await expect(record).toContainText('Taste drücken');
  await page.keyboard.press('F4');
  await expect(record).toContainText('F4');
  await expect(page.getByTestId('voice-pill')).toHaveCount(0);
});
