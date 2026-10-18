// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_VOICE_PREFS, readVoicePrefs, writeVoicePrefs } from './settings';

beforeEach(() => localStorage.clear());

describe('voice preferences', () => {
  it('are off by default, with F4 and no global key', () => {
    expect(readVoicePrefs()).toEqual({
      enabled: false,
      key: 'F4',
      globalHotkey: '',
      noticeSeen: false,
    });
    expect(DEFAULT_VOICE_PREFS.enabled).toBe(false);
  });

  it('persist per device and merge patches', () => {
    writeVoicePrefs({ enabled: true, noticeSeen: true });
    writeVoicePrefs({ key: 'Alt+M' });
    expect(readVoicePrefs()).toEqual({
      enabled: true,
      key: 'Alt+M',
      globalHotkey: '',
      noticeSeen: true,
    });
  });

  it('survive broken storage content', () => {
    localStorage.setItem('tm-voice', '{nope');
    expect(readVoicePrefs()).toEqual(DEFAULT_VOICE_PREFS);
    localStorage.setItem('tm-voice', JSON.stringify({ enabled: 'yes', key: 5 }));
    expect(readVoicePrefs().enabled).toBe(false);
    expect(readVoicePrefs().key).toBe('F4');
  });

  it('store only switches and keys, never text or audio', () => {
    writeVoicePrefs({ enabled: true });
    expect(Object.keys(JSON.parse(localStorage.getItem('tm-voice')!)).sort()).toEqual([
      'enabled',
      'globalHotkey',
      'key',
      'noticeSeen',
    ]);
  });
});
