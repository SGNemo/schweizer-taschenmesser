import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup } from './helpers.js';

describe('serving the PWA', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'tm-web-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Nemo</title>');
    writeFileSync(join(dir, 'app.js'), 'console.log(1)');
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('serves files, falls back to index.html for app routes, and keeps the API a 404 for unknown paths', async () => {
    const { app, store } = await setup({ webDir: dir });
    expect((await app.inject({ url: '/app.js' })).body).toBe('console.log(1)');
    const route = await app.inject({ url: '/finance?tab=accounts' });
    expect(route.statusCode).toBe(200);
    expect(route.body).toContain('Nemo');
    expect(
      (
        await app.inject({
          url: '/v1/nope',
          headers: { authorization: 'Bearer test-token-0123456789abcdef' },
        })
      ).statusCode,
    ).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/somewhere' })).statusCode).toBe(404);
    await app.close();
    store.close();
  });

  it('does not serve anything when no web directory is configured', async () => {
    const { app, store } = await setup();
    expect((await app.inject({ url: '/' })).statusCode).toBe(404);
    await app.close();
    store.close();
  });
});
