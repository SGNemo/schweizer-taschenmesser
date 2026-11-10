import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

/**
 * The `autoFocus` guard through the real `eslint.config.js` (UI audit 2026-11, follow-up to package 0a):
 * it shares the core rule `no-restricted-syntax` with the platform isolation and the fixed-locale rule, and
 * ESLint replaces a rule's options per file, so every block must carry it and none may lose the others.
 */
const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const eslint = new ESLint({ cwd: WEB });

async function restricted(file: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: resolve(WEB, file) });
  return result!.messages.filter((m) => m.ruleId === 'no-restricted-syntax').map((m) => m.message);
}
const FOCUS = 'export const A = () => <input autoFocus />;\n';

describe('eslint: no autoFocus', () => {
  it('is an error in every .tsx under src/, whichever block sets the rule for the file', async () => {
    for (const file of [
      'src/modules/finance/routes/FinancePage.tsx',
      'src/ui/Dialog.tsx',
      'src/layout/AppShell.tsx',
      'src/pages/Settings.tsx',
      'src/core/platform/web/Picker.tsx',
      'src/core/i18n/Switch.tsx',
      'src/modules/finance/__tests__/page.test.tsx',
      'src/core/platform/web/Picker.test.tsx',
    ]) {
      const messages = await restricted(file, FOCUS);
      expect(messages, file).toHaveLength(1);
      expect(messages[0], file).toContain('data-autofocus');
    }
  });

  it('with a value it is the same attribute', async () => {
    for (const code of [
      'export const A = () => <input autoFocus={true} />;\n',
      'export const A = (p: { first: boolean }) => <textarea autoFocus={p.first} />;\n',
      'export const A = () => <Field autoFocus label="x" />;\n',
    ])
      expect(await restricted('src/home/x.tsx', code), code).toHaveLength(1);
  });

  it('data-autofocus, other attributes and the word in text are not hits', async () => {
    const code =
      'export const A = () => <input data-autofocus autoComplete="off" />;\nexport const s = \'autoFocus\';\nexport const o = { autoFocus: true };\n';
    expect(await restricted('src/home/x.tsx', code)).toEqual([]);
  });

  it('the rules that share no-restricted-syntax still hold next to it', async () => {
    const tauri = "import { invoke } from '@tauri-apps/api/core';\nexport const x = invoke;\n";
    const de = "export const d = new Date(0).toLocaleDateString('de-DE');\n";
    expect(await restricted('src/modules/finance/x.tsx', tauri + de + FOCUS)).toHaveLength(3);
    expect(await restricted('src/core/platform/web/x.tsx', de + FOCUS)).toHaveLength(2);
    expect(await restricted('src/core/i18n/x.tsx', tauri + FOCUS)).toHaveLength(2);
  });
});
