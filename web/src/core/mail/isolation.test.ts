import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory()
      ? files(p)
      : /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n)
        ? [p]
        : [];
  });

describe('mail never reaches a model', () => {
  it('no file under core/ai imports core/mail or the mail module', () => {
    for (const f of files(join(SRC, 'core', 'ai'))) {
      const text = readFileSync(f, 'utf8');
      expect(text, f).not.toMatch(
        /from '@\/core\/mail|from '@\/modules\/mail|connectors\/google\/gmail/,
      );
    }
  });

  it('the mail module has no aiSchema, no searchable fields, and is not offered to the data API', () => {
    const manifest = readFileSync(join(SRC, 'modules', 'mail', 'manifest.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(manifest).not.toMatch(/aiSchema|searchable/);
    expect(manifest).toMatch(/dataApi: false/);
  });

  it('connector code stays free of core/ai (mail text must never reach a model)', () => {
    for (const f of files(join(SRC, 'connectors'))) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/from '@\/core\/ai/);
    }
  });

  it('the local-model door has no way to a cloud model: no router, no cloud adapters, no cloud notice', () => {
    const src = readFileSync(join(SRC, 'core', 'mail', 'localAi.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(
      /createRouterProvider|createProviderFor|createClaudeProvider|createOpenAiCompatibleProvider|requireNotice|cloud-ai/,
    );
    // the only provider adapter it may build is Ollama, and only behind the loopback-only fetch
    expect(src).toMatch(/createOllamaProvider/);
    expect(src).toMatch(/loopbackOnly\(deps\.fetch\)/);
  });

  it('only the mail module reaches the local-model door', () => {
    const offenders: string[] = [];
    for (const f of files(SRC)) {
      if (f.includes(join('core', 'mail')) || f.includes(join('modules', 'mail'))) continue;
      if (/from '@\/core\/mail\/(localAi|localAssist)'/.test(readFileSync(f, 'utf8')))
        offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });
});
