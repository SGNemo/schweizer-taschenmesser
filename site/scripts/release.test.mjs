import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { toReleaseInfo, isReleaseInfo } from './lib/release.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

const fixture = {
  tag_name: 'v0.3.1',
  published_at: '2026-10-01T12:53:55Z',
  assets: [
    { name: 'latest.json', state: 'uploaded', size: 1388, digest: 'sha256:1cf7' },
    { name: 'Nemo-Portable.exe', state: 'uploaded', size: 10331648, digest: 'sha256:' + 'f'.repeat(64) },
    { name: 'Nemo.apk', state: 'uploaded', size: 20632348 },
  ],
};

test('maps the GitHub release to the site shape', () => {
  const info = toReleaseInfo(fixture, new Date('2026-10-06T00:00:00Z'));
  assert.equal(info.version, '0.3.1');
  assert.equal(info.tag, 'v0.3.1');
  assert.equal(info.publishedAt, '2026-10-01');
  assert.equal(info.assets.windows.size, 10331648);
  assert.equal(info.assets.windows.sha256, 'f'.repeat(64));
  assert.equal(info.assets.android.sha256, null);
  assert.ok(isReleaseInfo(info));
});

test('rejects answers without the stable assets', () => {
  assert.throws(() => toReleaseInfo({ tag_name: 'v9', assets: [] }), /missing/);
  assert.throws(() => toReleaseInfo({}), /shape/);
});

test('the committed fallback has the expected shape', () => {
  const data = JSON.parse(readFileSync(path.join(here, '..', 'src', 'release', 'latest.json'), 'utf8'));
  assert.ok(isReleaseInfo(data));
});
