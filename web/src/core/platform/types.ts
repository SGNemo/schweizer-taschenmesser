import type { NotificationService } from '@/core/notifications/service';
import type { SecretStore } from '@/core/secrets/types';
import type { UpdateService } from '@/core/update/types';
import type { DiskService } from './disk';
import type { SystemService } from './system';

/**
 * Everything that differs between running in a browser (PWA) and inside the native Tauri shell.
 * The rest of the app only talks to this interface (`getPlatform()`); there are no scattered
 * "am I in Tauri?" checks (enforced by ESLint, see `core/platform` in docs/RULES.md).
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

/**
 * Receives the redirect of an OAuth "installed app" login on a one-shot loopback port
 * (`http://127.0.0.1:<port>/callback`). Only the desktop shell can; elsewhere `supported` is false.
 */
export interface OAuthLoopback {
  supported: boolean;
  /** Binds the port. Call `wait` after the browser was opened with `redirectUri`. */
  start(): Promise<{
    redirectUri: string;
    /** Resolves with the authorization code; rejects with `timeout`, `denied: …` or `listen-failed: …`. */
    wait(state: string, timeoutSeconds?: number): Promise<{ code: string }>;
  }>;
}

/** A request to the local AI import API that passed the native checks (Host, Origin, token, limits). */
export interface LocalApiRequest {
  id: number;
  /** Id of the token that authenticated it (never the token itself). */
  tokenId: string;
  method: string;
  path: string;
  query: string;
  idempotencyKey: string | null;
  body: string | null;
}

export interface LocalApiServerToken {
  id: string;
  /** SHA-256 of the token, hex. */
  hash: string;
  expiresAt: number | null;
}

/** Loopback-only HTTP server of the desktop shell (`src-tauri/crates/local-api`); elsewhere unsupported. */
export interface LocalApiService {
  supported: boolean;
  /** Starts (or restarts) on `127.0.0.1:<port>`; resolves with the bound port. Errors: `port-in-use`, `port-denied`, `listen-failed`. */
  start(
    port: number,
    tokens: LocalApiServerToken[],
    onRequest: (req: LocalApiRequest) => Promise<{ status: number; body: string }>,
  ): Promise<number>;
  setTokens(tokens: LocalApiServerToken[]): Promise<void>;
  stop(): Promise<void>;
}

/** Text or a link another Android app shared with this app. */
export interface SharedContent {
  title: string;
  text: string;
}

/** Android "Share" target. `supported` is false everywhere except the Android app. */
export interface ShareService {
  supported: boolean;
  /** The latest share since the last call (each share is returned once), or `undefined`. */
  takePending(): Promise<SharedContent | undefined>;
}

/** Why a global hotkey could not be set: unparsable, owned by another program, or refused by the OS. */
export type HotkeyError = 'invalid' | 'taken' | 'failed';

export interface TrayLabels {
  capture: string;
  open: string;
  quit: string;
  tooltip: string;
}

/**
 * Desktop shell extras for quick capture (tray, global hotkey, start with Windows). `supported` is
 * true only in the native desktop app; everything else is a no-op there.
 */
export interface DesktopService {
  supported: boolean;
  /** Registers the capture hotkey (`null` removes it). Resolves to an error code, or `null` on success. */
  setHotkey(accelerator: string | null): Promise<HotkeyError | null>;
  /** True = the window's close button hides the app in the tray instead of quitting. */
  setCloseToTray(enabled: boolean): Promise<void>;
  setTrayLabels(labels: TrayLabels): Promise<void>;
  setAutostart(enabled: boolean): Promise<void>;
  autostart(): Promise<boolean>;
  /** `portable`: the app runs from a folder with a `data/` directory (e.g. a USB stick). */
  info(): Promise<{ portable: boolean }>;
  showMain(): Promise<void>;
  /** Capture window only. */
  hideCapture(): Promise<void>;
  /** Capture window only; call it only when the user turned clipboard prefill on. */
  readClipboard(): Promise<string | undefined>;
  /** Capture window only: fires every time the window is opened. Returns an unsubscribe function. */
  onCaptureOpen(callback: () => void): () => void;
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
  oauth: OAuthLoopback;
  localApi: LocalApiService;
  /** Drive overview and read-only scans for the disk module (desktop only). */
  disk: DiskService;
  /** Read-only system facts for the system module (desktop only). */
  system: SystemService;
  desktop: DesktopService;
  share: ShareService;
  /** Offers a file to the user: browser download, or a "save as" dialog in the native shell. */
  saveFile(req: SaveFileRequest): Promise<'saved' | 'cancelled'>;
  clipboard: {
    /** Plain copy for non-secret text (e.g. the schema handed to an AI tool). */
    writeText(text: string): Promise<void>;
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
    /** Reads a text file from the app's data folder (native only; optional so existing fakes keep compiling). */
    read?(path: string): Promise<string>;
  };
  /** Self-update of the installed app; `supported` is false in the browser. */
  updater: UpdateService;
  lifecycle: {
    /** Calls back when the app goes to the background / is minimised. Returns an unsubscribe function. */
    onBackground(callback: () => void): () => void;
  };
}
