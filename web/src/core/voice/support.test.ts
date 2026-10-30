import { describe, expect, it } from 'vitest';
import { LANGS } from '@/core/i18n/lang';
import {
  findRecognitionCtor,
  recognitionLang,
  voiceSupport,
  type RecognitionCtor,
} from './support';

const Ctor = class {} as unknown as RecognitionCtor;

describe('voice availability', () => {
  it('is available with the standard or the webkit constructor', () => {
    expect(voiceSupport({ SpeechRecognition: Ctor, isSecureContext: true })).toEqual({ ok: true });
    expect(voiceSupport({ webkitSpeechRecognition: Ctor, isSecureContext: true })).toEqual({
      ok: true,
    });
    expect(findRecognitionCtor({ webkitSpeechRecognition: Ctor })).toBe(Ctor);
  });

  it('is hidden where the engine is missing (Firefox, Android WebView, WebKitGTK)', () => {
    expect(voiceSupport({})).toEqual({ ok: false, reason: 'no-api' });
    expect(voiceSupport(undefined)).toEqual({ ok: false, reason: 'no-api' });
  });

  it('is hidden on an insecure page', () => {
    expect(voiceSupport({ SpeechRecognition: Ctor, isSecureContext: false })).toEqual({
      ok: false,
      reason: 'insecure',
    });
  });

  it('follows the UI language for every language the app has', () => {
    expect(LANGS.map(recognitionLang)).toEqual(['de-DE', 'en-US', 'es-ES', 'fr-FR', 'pt-BR']);
  });
});
