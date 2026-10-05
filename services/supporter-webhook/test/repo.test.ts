import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (f: string) => readFileSync(resolve(__dirname, '..', f), 'utf8');

describe('repository hygiene of the service', () => {
  it('wrangler.toml and .env.example hold placeholders only, no real secret shapes', () => {
    for (const file of ['wrangler.toml', '.env.example']) {
      const text = read(file);
      expect(text, file).not.toMatch(/\bre_[A-Za-z0-9]{16,}/); // Resend key
      expect(text, file).not.toMatch(/[0-9a-f]{64}/i); // a real hex key
      expect(text, file).not.toMatch(/BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY/);
    }
    expect(read('wrangler.toml')).toContain('REPLACE_WITH_KV_NAMESPACE_ID');
    expect(read('.env.example')).toContain('replace-with');
  });

  it('declares no secret as a plain variable', () => {
    const vars = /\[vars\]([\s\S]*?)(\n\[|$)/.exec(read('wrangler.toml'))![1]!;
    for (const secret of [
      'KOFI_VERIFICATION_TOKEN',
      'SUPPORTER_SIGNING_KEY',
      'RESEND_API_KEY',
      'HASH_PEPPER',
      'OWNER_EMAIL',
    ])
      expect(vars).not.toContain(secret);
  });

  it('the service has no connection to the sync server or app data', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
    expect(Object.keys(pkg.dependencies)).toEqual(['zod']);
    for (const f of [
      'src/index.ts',
      'src/issue.ts',
      'src/queue.ts',
      'src/resend.ts',
      'src/mail.ts',
    ]) {
      expect(read(f), f).not.toMatch(/from '(\.\.\/)+(web|server|mcp|extension)\//);
    }
  });
});
