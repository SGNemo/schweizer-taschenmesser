import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EXTENSION_ID, HOST_NAME } from '@nemo/vault-core';

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8')) as {
  key: string;
  permissions: string[];
  content_scripts: { matches: string[] }[];
};

describe('manifest and ids', () => {
  it('the extension id is the one derived from the manifest key', () => {
    const der = Buffer.from(manifest.key, 'base64');
    const id = [...createHash('sha256').update(der).digest('hex').slice(0, 32)]
      .map((c) => String.fromCharCode('a'.charCodeAt(0) + parseInt(c, 16)))
      .join('');
    expect(id).toBe(EXTENSION_ID);
  });
  it('host allowlist (Rust) and e2e constants agree with the protocol package', () => {
    const rust = readFileSync('../web/src-tauri/crates/vault-bridge/src/manifest.rs', 'utf8');
    expect(rust).toContain(`EXTENSION_ID: &str = "${EXTENSION_ID}"`);
    expect(rust).toContain(`HOST_NAME: &str = "${HOST_NAME}"`);
    const fixtures = readFileSync('e2e/fixtures.ts', 'utf8');
    expect(fixtures).toContain(`'${EXTENSION_ID}'`);
    expect(fixtures).toContain(`'${HOST_NAME}'`);
  });
  it('asks for no storage permission and no broad host access', () => {
    expect(manifest.permissions).not.toContain('storage');
    expect(manifest.permissions).not.toContain('tabs');
    expect(manifest).not.toHaveProperty('host_permissions');
  });
});
