import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { auditFiles, checkSignatures, minisignKeyId, zipEntries } from './audit';

const file = (name: string, content: string | Buffer) => ({
  name,
  data: Buffer.isBuffer(content) ? content : Buffer.from(content),
});

/** A minimal ZIP with deflated entries (what an APK is). */
function zip(entries: Record<string, string | Buffer>, method: 0 | 8 = 8): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const raw = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const data = method === 8 ? deflateRawSync(raw) : raw;
    const nameBuf = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    chunks.push(local, nameBuf, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(method, 10);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(raw.length, 24);
    c.writeUInt16LE(nameBuf.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, dir, end]);
}

const KEYSTORE = Buffer.concat([
  Buffer.from([0xfe, 0xed, 0xfe, 0xed]),
  Buffer.from('a-very-long-random-keystore-body-0123456789'),
]);
const SECRETS = [
  { name: 'ANDROID_KEYSTORE_BASE64', value: KEYSTORE.toString('base64') },
  { name: 'ANDROID_KEYSTORE_PASSWORD', value: 'correct-horse-battery-staple' },
  { name: 'EMPTY', value: '' },
  { name: 'SHORT', value: 'abc' },
];

describe('zipEntries', () => {
  it('reads stored and deflated entries', () => {
    for (const method of [0, 8] as const) {
      const entries = zipEntries(zip({ 'a.txt': 'hello', 'dir/b.bin': 'world' }, method));
      expect(entries.map((e) => [e.name, e.data.toString()])).toEqual([
        ['a.txt', 'hello'],
        ['dir/b.bin', 'world'],
      ]);
    }
  });
  it('survives garbage', () => {
    expect(zipEntries(Buffer.from('not a zip at all'))).toEqual([]);
  });
});

describe('auditFiles', () => {
  it('passes for ordinary build output', () => {
    expect(
      auditFiles(
        [
          file('dist/index.js', 'console.log("hi")'),
          file('a.apk', zip({ 'classes.dex': 'dex', 'res/x.png': 'png' })),
        ],
        SECRETS,
      ),
    ).toEqual([]);
  });

  it('finds a secret value – plain, base64-decoded keystore bytes, and inside an APK', () => {
    const findings = auditFiles(
      [
        file('dist/config.js', 'password=correct-horse-battery-staple'),
        file('raw.bin', Buffer.concat([Buffer.from('xx'), KEYSTORE])),
        file('app.apk', zip({ 'assets/leak.txt': `oops ${KEYSTORE.toString('base64')}` })),
      ],
      SECRETS,
    );
    expect(findings).toEqual(
      expect.arrayContaining([
        { file: 'dist/config.js', rule: 'secret-value', detail: 'ANDROID_KEYSTORE_PASSWORD' },
        { file: 'raw.bin', rule: 'secret-value', detail: 'ANDROID_KEYSTORE_BASE64' },
        {
          file: 'app.apk!assets/leak.txt',
          rule: 'secret-value',
          detail: 'ANDROID_KEYSTORE_BASE64',
        },
      ]),
    );
    // never prints the value itself
    expect(JSON.stringify(findings)).not.toContain('correct-horse');
  });

  it('ignores empty and very short secrets', () => {
    expect(auditFiles([file('x', 'abc EMPTY')], SECRETS)).toEqual([]);
  });

  it('finds private key material by content', () => {
    const pem = '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----';
    const tauri = Buffer.from(
      'untrusted comment: rsign encrypted secret key\nRWRTY0Iy...',
    ).toString('base64');
    const findings = auditFiles(
      [
        file('a.txt', pem),
        file('b.txt', `key: ${tauri}`),
        file('c.txt', 'untrusted comment: minisign encrypted secret key\nRWRT'),
      ],
      [],
    );
    expect(findings.map((f) => [f.file, f.rule]).sort()).toEqual(
      [
        ['a.txt', 'pem-private-key'],
        ['b.txt', 'tauri-secret-key-base64'],
        ['c.txt', 'minisign-secret-key'],
      ].sort(),
    );
  });

  it('does not flag the harmless phrase "secret key" or a public key', () => {
    const pub = Buffer.from(
      'untrusted comment: minisign public key: 3CDE64C14F49277E\nRWR+J0lP',
    ).toString('base64');
    expect(
      auditFiles([file('doc.md', 'Keep your secret key safe.'), file('conf.json', pub)], []),
    ).toEqual([]);
  });

  it('flags keystores, env files and databases by name – but not the test/example env files', () => {
    const findings = auditFiles(
      [
        'release.jks',
        'x/upload.keystore',
        '.env',
        'server/.env.local',
        'data/sync.db',
        'cert.p12',
        'id_rsa',
      ].map((n) => file(n, 'x')),
      [],
    );
    expect(findings.map((f) => f.file).sort()).toEqual(
      [
        '.env',
        'cert.p12',
        'data/sync.db',
        'id_rsa',
        'release.jks',
        'server/.env.local',
        'x/upload.keystore',
      ].sort(),
    );
    expect(
      auditFiles([file('server/.env.example', 'SYNC_TOKEN='), file('web/.env.e2e', 'X=1')], []),
    ).toEqual([]);
  });
});

describe('updater signature check', () => {
  const b64 = (id: string, kind: string) => {
    const raw = Buffer.concat([
      Buffer.from('Ed'),
      Buffer.from(id, 'hex').reverse(),
      Buffer.alloc(32, 7),
    ]);
    return Buffer.from(`untrusted comment: ${kind}\n${raw.toString('base64')}\n`).toString(
      'base64',
    );
  };
  it('reads key ids from public keys and signatures', () => {
    expect(minisignKeyId(b64('3CDE64C14F49277E', 'minisign public key'))).toBe('3CDE64C14F49277E');
    expect(minisignKeyId('###')).toBeUndefined();
  });
  it('accepts signatures of the matching key and rejects others', () => {
    const pub = b64('3CDE64C14F49277E', 'minisign public key');
    expect(
      checkSignatures([{ name: 'a.sig', content: b64('3CDE64C14F49277E', 'signature') }], pub),
    ).toEqual([]);
    expect(
      checkSignatures([{ name: 'b.sig', content: b64('76760D11981F2BAC', 'signature') }], pub),
    ).toEqual([
      {
        file: 'b.sig',
        rule: 'signature-key-mismatch',
        detail: '76760D11981F2BAC ≠ 3CDE64C14F49277E',
      },
    ]);
    expect(checkSignatures([{ name: 'c.sig', content: 'garbage' }], pub)[0]!.rule).toBe(
      'unreadable-signature',
    );
    expect(checkSignatures([], 'garbage')[0]!.rule).toBe('unreadable-public-key');
  });
});
