import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup } from './helpers.js';

// R6 (launch review 2026-11): the self-hosted PWA shipped without CSP, frame-ancestors or nosniff.
// The served app now gets the same CSP as the desktop shell, cannot be framed, and is not sniffed.
describe('headers of the served PWA', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'tm-headers-'));
    writeFileSync(
      join(dir, 'index.html'),
      '<!doctype html><title>Nemo</title><script>var theme = 1;</script><script type="module" src="/app.js"></script>',
    );
    writeFileSync(
      join(dir, 'capture.html'),
      '<!doctype html><title>Nemo</title><script>var capture = 1;</script>',
    );
    writeFileSync(join(dir, 'app.js'), 'console.log(1)');
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('the page, its files and the app routes carry them', async () => {
    const { app } = await setup({ webDir: dir });
    for (const url of ['/', '/app.js', '/finance?tab=accounts']) {
      const res = await app.inject({ url });
      expect(res.statusCode, url).toBe(200);
      const csp = String(res.headers['content-security-policy'] ?? '');
      expect(csp, url).toContain("frame-ancestors 'none'");
      expect(csp, url).toContain("object-src 'none'");
      expect(csp, url).toContain("img-src 'self' data: blob:");
      expect(res.headers['x-content-type-options'], url).toBe('nosniff');
      expect(res.headers['referrer-policy'], url).toBe('no-referrer');
    }
  });

  it('allows the inline script of index.html by its hash, never all inline scripts', async () => {
    const { app } = await setup({ webDir: dir });
    const csp = String((await app.inject({ url: '/' })).headers['content-security-policy']);
    const hash = createHash('sha256').update('var theme = 1;').digest('base64');
    expect(csp).toMatch(/script-src 'self' 'wasm-unsafe-eval' 'sha256-[^;]*;/);
    expect(csp).toContain(`'sha256-${hash}'`);
    expect(csp).not.toContain("'unsafe-inline' 'sha256");
  });

  it('the inline scripts of the other built pages (capture.html) are allowed as well', async () => {
    const { app } = await setup({ webDir: dir });
    const res = await app.inject({ url: '/capture.html' });
    const hash = createHash('sha256').update('var capture = 1;').digest('base64');
    expect(String(res.headers['content-security-policy'])).toContain(`'sha256-${hash}'`);
  });
});
