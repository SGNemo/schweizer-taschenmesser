import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

/**
 * The fixed-locale rule through the real `eslint.config.js` (UI audit 2026-11, package 0a-1b): which files
 * it reaches matters as much as the selector, and it must not switch the platform selectors off, which
 * share the core rule `no-restricted-syntax`.
 */
const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const eslint = new ESLint({ cwd: WEB });

async function restricted(file: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: resolve(WEB, file) });
  return result!.messages.filter((m) => m.ruleId === 'no-restricted-syntax').map((m) => m.message);
}
const DE = "export const d = new Date(0).toLocaleDateString('de-DE');\n";
const TAURI = "import { invoke } from '@tauri-apps/api/core';\nexport const x = invoke;\n";

describe("eslint: no fixed 'de-DE'", () => {
  it('is an error in app code, as a string and as a plain template', async () => {
    for (const file of [
      'src/modules/finance/money.ts',
      'src/ui/Chart.tsx',
      'src/core/platform/web/index.ts',
      'src/core/db/repo.ts',
    ]) {
      const messages = await restricted(file, DE);
      expect(messages, file).toHaveLength(1);
      expect(messages[0], file).toContain('core/i18n/format');
    }
    expect(
      await restricted('src/home/x.ts', 'export const f = new Intl.NumberFormat(`de-DE`);\n'),
    ).toHaveLength(1);
  });

  it('is allowed where a language is mapped to its locale tag, and in tests', async () => {
    for (const file of [
      'src/core/i18n/format.ts',
      'src/core/time/dates.ts',
      'src/core/voice/support.ts',
      'src/modules/finance/money.test.ts',
      'src/core/platform/web/index.test.ts',
      'src/ui/Chart.test.tsx',
    ])
      expect(await restricted(file, DE), file).toEqual([]);
  });

  it('other locales, longer strings and built templates are not the literal', async () => {
    const code =
      "export const a = 'en-US'; export const b = 'de-DE-x'; export const c = (r: string) => `de-${r}`;\n";
    expect(await restricted('src/home/x.ts', code)).toEqual([]);
  });

  it('the platform isolation that shares the rule still holds, and only outside core/platform', async () => {
    expect(await restricted('src/modules/finance/money.ts', TAURI)).toHaveLength(1);
    expect(await restricted('src/modules/finance/money.test.ts', TAURI)).toHaveLength(1);
    expect(await restricted('src/core/platform/tauri/index.ts', TAURI)).toEqual([]);
    expect(await restricted('src/modules/finance/money.ts', TAURI + DE)).toHaveLength(2);
  });
});
