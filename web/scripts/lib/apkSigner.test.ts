import { describe, expect, it } from 'vitest';
import { checkApkSigner, signerDigests, STABLE_APK_CERT_SHA256 } from './apkSigner';

/** What `apksigner verify --print-certs` prints (digests invented except the stable one). */
const printed = (digest: string) => `Verifies
Verified using v2 scheme (APK Signature Scheme v2): true
Number of signers: 1
Signer #1 certificate DN: CN=Invented, O=Example
Signer #1 certificate SHA-256 digest: ${digest}
Signer #1 certificate SHA-1 digest: 0123456789abcdef0123456789abcdef01234567
`;
const DEV = 'aa'.repeat(32);

describe('APK signer (SC2: the dev APK never carries the release key)', () => {
  it('reads the SHA-256 digests', () => {
    expect(signerDigests(printed(DEV))).toEqual([DEV]);
  });

  it('a dev build signed with its own key passes; with the release key it fails', () => {
    expect(checkApkSigner(printed(DEV), 'dev')).toEqual([]);
    expect(checkApkSigner(printed(STABLE_APK_CERT_SHA256), 'dev').map((f) => f.rule)).toEqual([
      'dev-apk-signed-with-release-key',
    ]);
  });

  it('a release must be signed with the release key, and only with it', () => {
    expect(checkApkSigner(printed(STABLE_APK_CERT_SHA256), 'release')).toEqual([]);
    expect(checkApkSigner(printed(DEV), 'release').map((f) => f.rule)).toEqual([
      'release-apk-wrong-key',
    ]);
  });

  it('a second signer next to the release key is not a release signature', () => {
    expect(
      checkApkSigner(
        printed(STABLE_APK_CERT_SHA256) + printed(DEV).replace(/Signer #1/g, 'Signer #2'),
        'release',
      ).map((f) => f.rule),
    ).toEqual(['release-apk-wrong-key']);
  });

  it('colons and upper case in the digest are read the same', () => {
    const colons = STABLE_APK_CERT_SHA256.toUpperCase().replace(/(..)(?!$)/g, '$1:');
    expect(checkApkSigner(printed(colons), 'dev').map((f) => f.rule)).toEqual([
      'dev-apk-signed-with-release-key',
    ]);
  });

  it('no digest at all is a finding', () => {
    expect(checkApkSigner('DOES NOT VERIFY', 'dev').map((f) => f.rule)).toEqual(['no-signer']);
  });
});
