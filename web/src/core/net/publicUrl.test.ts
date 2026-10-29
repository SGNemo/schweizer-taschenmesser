import { describe, expect, it } from 'vitest';
import { isInsecureRemoteUrl, isPublicHost, isPublicHttpsUrl } from './publicUrl';

describe('publicUrl', () => {
  it('warns about http except for this computer', () => {
    expect(isInsecureRemoteUrl('http://192.168.1.20:8787')).toBe(true);
    expect(isInsecureRemoteUrl('http://mein-pc.tailnet.ts.net')).toBe(true);
    expect(isInsecureRemoteUrl('http://localhost:8787')).toBe(false);
    expect(isInsecureRemoteUrl('http://127.0.0.1:8787')).toBe(false);
    expect(isInsecureRemoteUrl('https://mein-pc.tailnet.ts.net')).toBe(false);
    expect(isInsecureRemoteUrl('kein url')).toBe(false);
  });

  it('judges public hosts by text', () => {
    expect(isPublicHost('cal.example.test')).toBe(true);
    expect(isPublicHost('8.8.8.8')).toBe(true);
    for (const h of [
      'localhost',
      '10.1.2.3',
      '172.20.0.1',
      '100.64.0.1',
      '0.0.0.0',
      'nas',
      '[::1]',
    ])
      expect(isPublicHost(h), h).toBe(false);
    expect(isPublicHttpsUrl('http://cal.example.test/x')).toBe(false);
  });
});
