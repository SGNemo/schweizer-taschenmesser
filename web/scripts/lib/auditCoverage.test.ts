import { describe, expect, it } from 'vitest';
import { coverageFindings } from './audit';

/** AUDIT_SECRET_ENV names and which of them have a value (the coverage check never sees values). */
const env = (...pairs: [string, boolean][]) => ({
  listed: pairs.map(([n]) => n),
  provided: pairs.filter(([, has]) => has).map(([n]) => n),
});
const KEY = env(['TAURI_SIGNING_PRIVATE_KEY', true]);

describe('audit coverage (SC9): nothing is waved through unseen', () => {
  it('fails on a path without files, also in a dry run', () => {
    expect(
      coverageFindings({ publish: false, paths: [{ path: '../assets', files: 0 }], ...env() }),
    ).toEqual([{ file: '../assets', rule: 'empty-path' }]);
  });

  it('passes a dry run with files and no secret values (dry runs get none)', () => {
    expect(
      coverageFindings({
        publish: false,
        paths: [{ path: 'dist', files: 3 }],
        ...env(['ANDROID_KEYSTORE_PASSWORD', false]),
      }),
    ).toEqual([]);
  });

  it('when publishing, every named secret must have reached the audit', () => {
    expect(
      coverageFindings({
        publish: true,
        paths: [{ path: 'dl', files: 4 }],
        ...env(['TAURI_SIGNING_PRIVATE_KEY', true], ['ANDROID_KEYSTORE_PASSWORD', false]),
      }),
    ).toEqual([
      { file: '(environment)', rule: 'secret-not-provided', detail: 'ANDROID_KEYSTORE_PASSWORD' },
    ]);
  });

  it('when publishing with a public key, at least one signature must be checked', () => {
    expect(
      coverageFindings({
        publish: true,
        paths: [{ path: 'dl', files: 4 }],
        ...KEY,
        signatures: 0,
      }),
    ).toEqual([{ file: 'dl', rule: 'no-signature' }]);
    expect(
      coverageFindings({
        publish: true,
        paths: [{ path: 'dl', files: 4 }],
        ...KEY,
        signatures: 1,
      }),
    ).toEqual([]);
    // without --pubkey-from (signatures undefined) nothing is required
    expect(coverageFindings({ publish: true, paths: [{ path: 'x', files: 1 }], ...KEY })).toEqual(
      [],
    );
  });

  it('publishing with no secret names at all is a finding (an emptied AUDIT_SECRET_ENV)', () => {
    expect(
      coverageFindings({ publish: true, paths: [{ path: 'dl', files: 4 }], ...env() }),
    ).toEqual([{ file: '(environment)', rule: 'secret-not-provided', detail: 'AUDIT_SECRET_ENV' }]);
  });

  it('publishing without any path is a finding, not a pass', () => {
    expect(coverageFindings({ publish: true, paths: [], ...KEY })).toEqual([
      { file: '(none)', rule: 'empty-path' },
    ]);
  });
});
