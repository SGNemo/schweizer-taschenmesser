import { describe, expect, it } from 'vitest';
import { isInsecureRemoteUrl, isPublicHost, isPublicHttpsUrl, isPublicImageUrl } from './publicUrl';

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
  it('ignores trailing dots, so a local name stays local', () => {
    expect(isPublicHost('localhost..')).toBe(false);
    expect(isPublicHost('nas.lan..')).toBe(false);
    expect(isPublicHost('example.org.')).toBe(true);
  });
  it('for mail images also refuses names a home router hands out', () => {
    for (const host of [
      'fritz.box',
      'nas.fritz.box',
      'printer.home.arpa',
      'pc.localdomain',
      'fritz.box.',
    ])
      expect(isPublicImageUrl(`https://${host}/x.png`), host).toBe(false);
    expect(isPublicImageUrl('https://example.org/x.png')).toBe(true);
    expect(isPublicImageUrl('http://example.org/x.png')).toBe(false);
    // feeds and calendar subscriptions the user entered keep working at such a name
    expect(isPublicHttpsUrl('https://nas.fritz.box/cal.ics')).toBe(true);
  });
});
