import type { Lang } from '@/core/i18n/lang';

/**
 * What the browser's speech recognition (Web Speech API) needs from us. Typed by hand: the DOM lib
 * has no `SpeechRecognition`. Recognition may send the audio to the browser vendor's service
 * (Chrome/Edge do); this module never touches audio, it only receives text.
 */
export interface RecognitionResultLike {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}
export interface RecognitionEventLike {
  readonly resultIndex: number;
  readonly results: { readonly length: number; readonly [i: number]: RecognitionResultLike };
}
export interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { readonly error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type RecognitionCtor = new () => RecognitionLike;

export interface RecognitionScope {
  SpeechRecognition?: RecognitionCtor;
  webkitSpeechRecognition?: RecognitionCtor;
  isSecureContext?: boolean;
}

export type Support = { ok: true } | { ok: false; reason: 'no-api' | 'insecure' };

export function findRecognitionCtor(
  scope: RecognitionScope | undefined = typeof window === 'undefined'
    ? undefined
    : (window as unknown as RecognitionScope),
): RecognitionCtor | undefined {
  return scope?.SpeechRecognition ?? scope?.webkitSpeechRecognition;
}

/**
 * Whether this device can do speech recognition at all. No API (Firefox, Android System WebView,
 * WebKitGTK) or an insecure page (the API needs https/localhost) → the voice key stays hidden.
 */
export function voiceSupport(
  scope: RecognitionScope | undefined = typeof window === 'undefined'
    ? undefined
    : (window as unknown as RecognitionScope),
): Support {
  if (!findRecognitionCtor(scope)) return { ok: false, reason: 'no-api' };
  if (scope?.isSecureContext === false) return { ok: false, reason: 'insecure' };
  return { ok: true };
}

/** Recognition language follows the UI language, never the system's or a guess from the text. */
const RECOGNITION_LANG: Record<Lang, string> = {
  de: 'de-DE',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  'pt-BR': 'pt-BR',
};

export const recognitionLang = (lang: Lang): string => RECOGNITION_LANG[lang];
