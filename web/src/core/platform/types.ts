import type { NotificationService } from '@/core/notifications/service';
import type { SecretStore } from '@/core/secrets/types';
import type { UpdateService } from '@/core/update/types';

/**
 * Everything that differs between running in a browser (PWA) and inside the native Tauri shell.
 * The rest of the app only talks to this interface (`getPlatform()`); there are no scattered
 * "am I in Tauri?" checks (enforced by ESLint, see `core/platform` in CLAUDE.md).
 */
export type PlatformKind = 'web' | 'desktop' | 'android';

export interface SaveFileRequest {
  fileName: string;
  data: string | Uint8Array | Blob;
  mime: string;
}

/** Texts of the system biometric prompt (they come from the app: the UI is German only). */
export interface BiometricPromptText {
  title: string;
  subtitle: string;
  cancel: string;
}

export type UnsealResult =
  | { status: 'ok'; secret: Uint8Array<ArrayBuffer> }
  /** The user dismissed the prompt. */
  | { status: 'cancelled' }
  /** Nothing is sealed under that name. */
  | { status: 'missing' }
  /** The device's biometrics changed; the sealed secret was destroyed by the OS. */
  | { status: 'invalidated' };

/**
 * A biometric gate in front of one small secret (the vault's data key). `available()` is false in the
 * browser and wherever the device has no enrolled biometrics / Windows Hello.
 */
export interface BiometricService {
  available(): Promise<boolean>;
  /** Stores `secret` behind the biometric prompt. `cancelled` = the user dismissed the prompt. */
  seal(
    name: string,
    secret: Uint8Array<ArrayBuffer>,
    prompt: BiometricPromptText,
  ): Promise<'sealed' | 'cancelled'>;
  unseal(name: string, prompt: BiometricPromptText): Promise<UnsealResult>;
  has(name: string): Promise<boolean>;
  remove(name: string): Promise<void>;
}

/** Screen-level protection (Android FLAG_SECURE); a no-op elsewhere. */
export interface ScreenService {
  setSecure(enabled: boolean): Promise<void>;
}

export interface PlatformService {
  readonly kind: PlatformKind;
  /** True inside the native shell (installed app), false in a browser tab / PWA. */
  readonly isNative: boolean;
  /**
   * `fetch` for third-party HTTP APIs. The native shell makes the request itself (no CORS
   * restrictions, plain-http LAN servers allowed); the browser is subject to CORS/mixed content.
   */
  fetch: typeof fetch;
  notifications: NotificationService;
  /** Where API keys are kept (device-local; see `core/secrets`). */
  secrets: SecretStore;
  biometrics: BiometricService;
  screen: ScreenService;
  /** Offers a file to the user: browser download, or a "save as" dialog in the native shell. */
  saveFile(req: SaveFileRequest): Promise<'saved' | 'cancelled'>;
  clipboard: {
    /** Copies `text` and clears the clipboard after `clearAfterMs` – unless something else was copied meanwhile. */
    writeSensitive(text: string, clearAfterMs: number): Promise<void>;
  };
  app: {
    version(): Promise<string>;
    openUrl(url: string): Promise<void>;
  };
  /** Files in the app's private data folder (pre-update backups). Not available in the browser. */
  files: {
    write(path: string, data: string | Uint8Array): Promise<void>;
    /** File names inside `dir` (empty when it does not exist). */
    list(dir: string): Promise<string[]>;
    remove(path: string): Promise<void>;
  };
  /** Self-update of the installed app; `supported` is false in the browser. */
  updater: UpdateService;
  lifecycle: {
    /** Calls back when the app goes to the background / is minimised. Returns an unsubscribe function. */
    onBackground(callback: () => void): () => void;
  };
}
