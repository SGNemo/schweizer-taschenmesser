import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// N9 (launch review 2026-11): the compose file published plain HTTP on every interface with no way
// to narrow it. The bind address is a setting now; behind a tunnel (Tailscale serve) it is
// 127.0.0.1, and the example file and the user doc say so.
const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

describe('publishing the server', () => {
  it('the bind address of the published port is a setting', () => {
    // unset: no host address at all, so Docker keeps publishing on IPv4 and IPv6 as before
    expect(read('docker-compose.yml')).toContain(
      "'${BIND_ADDRESS:+${BIND_ADDRESS}:}${PORT:-8787}:8787'",
    );
  });

  it('the example file and both user docs explain 127.0.0.1 behind a tunnel', () => {
    expect(read('.env.example')).toMatch(/# BIND_ADDRESS=127\.0\.0\.1/);
    for (const doc of ['../docs/user/sync.md', '../docs/user/sync.de.md']) {
      expect(read(doc), doc).toContain('BIND_ADDRESS=127.0.0.1');
    }
  });
});
