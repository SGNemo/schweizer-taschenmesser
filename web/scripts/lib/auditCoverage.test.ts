import { describe, expect, it } from 'vitest';
import { coverageFindings } from './audit';

const secret = (name: string, value: string) => ({ name, value });

describe('audit coverage (SC9): nothing is waved through unseen', () => {
  it('fails on a path without files, also in a dry run', () => {
    expect(
      coverageFindings({ publish: false, paths: [{ path: '../assets', files: 0 }], secrets: [] }),
    ).toEqual([{ file: '../assets', rule: 'empty-path' }]);
  });

  it('passes a dry run with files and no secret values (dry runs get none)', () => {
    expect(
      coverageFindings({
        publish: false,
        paths: [{ path: 'dist', files: 3 }],
        secrets: [secret('ANDROID_KEYSTORE_PASSWORD', '')],
      }),
    ).toEqual([]);
  });

  it('when publishing, every named secret must have reached the audit', () => {
    expect(
      coverageFindings({
        publish: true,
        paths: [{ path: 'dl', files: 4 }],
        secrets: [
          secret('TAURI_SIGNING_PRIVATE_KEY', 'invented-value-for-the-test'),
          secret('ANDROID_KEYSTORE_PASSWORD', '  '),
        ],
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
        secrets: [],
        signatures: 0,
      }),
    ).toEqual([{ file: 'dl', rule: 'no-signature' }]);
    expect(
      coverageFindings({
        publish: true,
        paths: [{ path: 'dl', files: 4 }],
        secrets: [],
        signatures: 1,
      }),
    ).toEqual([]);
    // without --pubkey-from (signatures undefined) nothing is required
    expect(
      coverageFindings({ publish: true, paths: [{ path: 'x', files: 1 }], secrets: [] }),
    ).toEqual([]);
  });

  it('publishing without any path is a finding, not a pass', () => {
    expect(coverageFindings({ publish: true, paths: [], secrets: [] })).toEqual([
      { file: '(none)', rule: 'empty-path' },
    ]);
  });
});
