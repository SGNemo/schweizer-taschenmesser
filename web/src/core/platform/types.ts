import type { NotificationService } from '@/core/notifications/service';
import type { SecretStore } from '@/core/secrets/types';
import type { UpdateService } from '@/core/update/types';
import type { DiskService } from './disk';
import type { LocalModelService } from './localModel';
import type { BrowserService } from './browser';
import type { CustomTabsService } from './customTabs';
import type { LaunchService } from './launch';
import type { DownloadsService } from './downloads';
import type { TorrentService } from './torrent';
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
 * What the cockpit needs from the window: full screen (desktop window, browser Fullscreen API),
 * Android immersive mode (system bars hidden, a swipe shows them briefly) and keeping the screen
 * on. Every part degrades to a no-op where it does not exist, so callers never branch on the kind.
 */
export interface DisplayService {
  /** True where `setFullscreen` does something (a desktop window, a browser with the Fullscreen API). */
  readonly fullscreenSupported: boolean;
  setFullscreen(on: boolean): Promise<void>;
  isFullscreen(): Promise<boolean>;
  /** Android only: hide status and navigation bars. */
  setImmersive(on: boolean): Promise<void>;
  /** Keep the screen on (Android window flag, browser wake lock). */
  setKeepAwake(on: boolean): Promise<void>;
}

/**
 * Receives the redirect of an OAuth "installed app" login on a one-shot loopback port
 * (`http://127.0.0.1:<port>/callback`). Only the desktop shell can; elsewhere `supported` is false.
 */
export interface OAuthLoopback {
  supported: boolean;
  /**
   * Binds the port. Call `wait` after the browser was opened with `redirectUri`. `preferredPort`
   * takes exactly that port or rejects with `port-busy: …` (providers that check the URI exactly).
   */
  start(opts?: { preferredPort?: number }): Promise<{
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
/** One request the native host relayed from the browser extension (already stamped with its origin). */
export interface VaultBridgeRequest {
  id: number;
  /** JSON text; validated by the app (`modules/accounts/bridge`), never trusted here. */
  body: string;
}

export interface VaultBridgeRegistration {
  browsers: { browser: string; registered: boolean }[];
  /** The manifest file names the executable that is running now. */
  upToDate: boolean;
  manifest: string;
}

export type VaultBridgeStartError = 'channel-taken' | 'failed';

/** Why the home-network hub does not listen (`lan_hub_status`). */
export type LanHubOffReason =
  'nothing-wanted' | 'unreadable' | 'no-home' | 'public-network' | 'no-network';

/** A device asking to pair; the PC shows `name` (plain text, the device's own claim) and `code`. */
export interface LanHubPending {
  attempt: number;
  name: string;
  code: string;
}

export interface LanHubStatus {
  running: boolean;
  state: 'off' | 'failed' | 'listening';
  reason?: LanHubOffReason | null;
  /** Windows files the network as "Public" and blocks incoming connections. */
  blocked: boolean;
  port?: number | null;
  pairingOpen: boolean;
  /** QR payload while a pairing window is open and the hub listens; renews itself. */
  qr?: string | null;
  pending?: LanHubPending | null;
  devices: number;
}

/** The versioned E2E data key (base64 of 32 bytes); handed to the web app only, never stored there raw. */
export interface LanHubDataKey {
  version: number;
  key: string;
}

/** A device's pairing result: the data key plus the hub it is pinned to (hex public key). */
export interface LanPairing extends LanHubDataKey {
  hub: string;
}

export interface LanHubDevice {
  /** Hex of the device's static key. */
  id: string;
  name: string;
  /** Unix seconds. */
  lastSeen?: number | null;
  revoked: boolean;
}

/**
 * Desktop only (Windows listens; elsewhere the hub stays off): the home-network sync hub of
 * `src-tauri/crates/lan-sync`. Every call rejects with a short code (`not-started`, `client-paired`,
 * `keystore-unavailable`, `busy`, `wrong-code`, …). Never logs, never stores the key in the web app
 * beyond the non-extractable `CryptoKey` the sync service imports.
 */
export interface LanHubService {
  supported: boolean;
  /** Starts the hub (idempotent) and returns its status and the current data key. */
  start(): Promise<{ status: LanHubStatus; dataKey: LanHubDataKey }>;
  stop(): Promise<void>;
  status(): Promise<LanHubStatus>;
  pairOpen(): Promise<void>;
  pairConfirm(attempt: number, code: string): Promise<void>;
  pairCancel(): Promise<void>;
  devices(): Promise<LanHubDevice[]>;
  revoke(id: string): Promise<boolean>;
  /** "Schlüssel erneuern": new key version, the hub store is emptied, devices pair again. */
  rotate(): Promise<LanHubDataKey>;
  /** The hub-local client's request (JSON text in, JSON text out; same shape as remote clients). */
  request(body: string): Promise<string>;
  /** "Dieses Netz als Heimnetz verwenden". */
  setHome(): Promise<void>;
}

export type RemoteLevel = 'off' | 'media' | 'full';

/** What a paired device may do: level, "ended at the PC" (paused), "unlock the phone first". */
export interface RemoteHostGrant {
  level: RemoteLevel;
  paused: boolean;
  unlock: boolean;
}

export interface RemoteHostDevice extends RemoteHostGrant {
  /** Hex of the device's static key. */
  id: string;
  /** Plain text, the device's own claim. */
  name: string;
  /** Unix seconds of the last sync contact. */
  lastSeen?: number | null;
}

export interface RemoteHostStatus {
  /** This PC can be controlled at all (Windows). */
  supported: boolean;
  /** The master switch. */
  enabled: boolean;
  /** Who controls this PC right now. */
  controller?: { id: string; name: string; level: RemoteLevel } | null;
  devices: RemoteHostDevice[];
}

/**
 * Desktop only: this PC's own remote-control settings (`src-tauri/src/remote.rs`). No call sends
 * input. Narrowing is immediate; every widening (a higher level, lifting a pause, dropping the
 * unlock request, the master switch) is asked by the PC in a native dialog first – the call
 * resolves after the answer. Errors are short codes: `not-started` (the hub is off), `cancelled`
 * (the person said no), `busy` (a question is already open), `busy-controlled` (not while mouse
 * and keyboard are controlled), `changed` (the grant changed while the question was open),
 * `not-found`, `failed`.
 */
export interface RemoteHostService {
  supported: boolean;
  status(): Promise<RemoteHostStatus>;
  setEnabled(enabled: boolean): Promise<void>;
  setDevice(id: string, grant: RemoteHostGrant): Promise<void>;
  /** "Fernsteuerung beenden": ends the session and pauses that device. `false`: nobody controlled. */
  end(): Promise<boolean>;
}

/**
 * The device side of home-network sync (Android, and a second PC that pairs with the hub PC):
 * pairing with a hub PC by its QR and the sync engine's requests (`src-tauri/src/lan_client.rs`). The device's own key and the pinned hub stay in
 * the OS keystore on the Rust side; only the data key comes back, once, after the pairing.
 * Errors are short codes: `bad-qr`, `network`, `pairing-not-possible`, `unknown-device`,
 * `pairing-aborted`, `cancelled`, `busy`, `not-paired`, `keystore-unavailable`, `protocol`, `hub-on`
 * (this PC is the hub itself: one path per device).
 */
export interface LanClientService {
  supported: boolean;
  /**
   * A scanner the platform brings (the E2E fake): returns the text of one QR code (rejects with
   * `cancelled`, `camera-denied` or `failed`). Absent on the phone: the app scans in its own camera
   * dialog (`QrScanDialog`), so no native view can cover the app.
   */
  scan?(): Promise<string>;
  /** Pairs with the hub of `qr`; `onCode` gets the 6-digit code to show while the PC asks. */
  pair(qr: string, name: string, onCode: (code: string) => void): Promise<LanPairing>;
  /** Stops waiting for the confirmation on the PC. */
  cancelPair(): Promise<void>;
  /** One sync request to the pinned hub `hub`; refused (`network`) during a pairing or for another hub. */
  request(body: string, hub: string): Promise<string>;
  /** Tells the hub once if it is reachable right now, then forgets hub and key on this device. */
  unpair(): Promise<void>;
}

/**
 * Android: the phone's Wi-Fi as home-network sync sees it (`src-tauri/plugins/lan-watch`). No
 * network name, no location: only whether some Wi-Fi network is connected. Elsewhere unsupported
 * (`wifi()` answers `undefined`, nothing fires). The plugin's search for a moved PC is Rust-only
 * and not part of this service.
 */
export interface LanWatchService {
  supported: boolean;
  /** Whether a Wi-Fi network is connected right now; `undefined` when unknown or unsupported. */
  wifi(): Promise<boolean | undefined>;
  /** Fires `true` when the first Wi-Fi network comes up, `false` when the last one goes. */
  onWifiChange(callback: (connected: boolean) => void): () => void;
}

/**
 * Desktop only: the channel to the browser extension's native messaging host. Nothing listens until
 * `start` is called; every request is answered with the JSON text the handler returns.
 */
export interface VaultBridgeService {
  supported: boolean;
  /** Resolves to an error code, or `null` once the server listens. */
  start(
    onRequest: (req: VaultBridgeRequest) => Promise<string>,
  ): Promise<VaultBridgeStartError | null>;
  stop(): Promise<void>;
  /** Writes the host manifest and the browser registry entries (rejects when that fails). */
  register(): Promise<VaultBridgeRegistration>;
  unregister(): Promise<void>;
  status(): Promise<VaultBridgeRegistration>;
}

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

/** Screens an Android launcher shortcut or the quick-settings tile may open (fixed list). */
export type ShortcutTarget = 'capture' | 'search' | 'today';

/** Text or a link another Android app shared with this app. */
export interface SharedContent {
  title: string;
  text: string;
  /** Set by a launcher shortcut or the quick-settings tile instead of a share (title/text empty). */
  open?: ShortcutTarget;
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
  /** The app language (`de`, `en`): the shell's own tray and dialog texts follow it. */
  lang?: string;
}

/**
 * The tray's "Heute" block (desktop): up to 5 short lines plus the two action labels. Only labels
 * cross to Rust; the routes stay in the web app (`core/platform/tauri/traySnapshot.ts`). No items =
 * the block is hidden and the tray menu looks as before.
 */
export interface TrayToday {
  heading: string;
  items: string[];
  now: string;
  timer: string;
}

/** One note of a reminder tone (see `core/notifications/sound.ts`); the native side renders it. */
export interface ToneNote {
  hz: number;
  /** Start in ms from the beginning of the tone. */
  atMs: number;
  durMs: number;
  /** 0–1, relative loudness of this note. */
  gain: number;
}

/**
 * Desktop shell extras for quick capture (tray, global hotkey, start with Windows). `supported` is
 * true only in the native desktop app; everything else is a no-op there.
 */
export interface DesktopService {
  supported: boolean;
  /** True when this launch asked for safe mode (`--safe-mode` or `NEMO_SAFE_MODE=1`); optional so fakes keep compiling. */
  safeMode?(): Promise<boolean>;
  /** Panic lines of earlier runs from the data folder (handed over once, then removed); optional so fakes keep compiling. */
  takePanicLog?(): Promise<string | null>;
  /**
   * True while Windows reports a full-screen game, presentation or busy state (one yes/no; no
   * process or window information). Optional so fakes keep compiling; absent = cannot tell.
   */
  gameActive?(): Promise<boolean>;
  /** Plays a short tone natively, for when the web view cannot (window hidden in the tray). */
  playTone?(notes: ToneNote[], volume: number): Promise<void>;
  /** Registers the capture hotkey (`null` removes it). Resolves to an error code, or `null` on success. */
  setHotkey(accelerator: string | null): Promise<HotkeyError | null>;
  /** Same for the vault search key (`null` removes it; unset by default). */
  setVaultHotkey(accelerator: string | null): Promise<HotkeyError | null>;
  /** Same for the voice input key (`null` removes it; unset by default). */
  setVoiceHotkey(accelerator: string | null): Promise<HotkeyError | null>;
  /** True = the window's close button hides the app in the tray instead of quitting. */
  setCloseToTray(enabled: boolean): Promise<void>;
  setTrayLabels(labels: TrayLabels): Promise<void>;
  /** Replaces the tray's "Heute" block; optional so fakes keep compiling (absent = `traySnapshot.ts` invokes the command). */
  setTrayToday?(today: TrayToday): Promise<void>;
  setAutostart(enabled: boolean): Promise<void>;
  autostart(): Promise<boolean>;
  /** `portable`: the app runs from a folder with a `data/` directory (e.g. a USB stick). */
  info(): Promise<{ portable: boolean }>;
  /** Path of the app's data folder ("Über Nemo"); undefined where there is none to show. */
  dataDir(): Promise<string | undefined>;
  /** Opens the data folder in the file manager (no argument: the app decides which folder). */
  openDataDir(): Promise<void>;
  showMain(): Promise<void>;
  /** Capture window only. */
  hideCapture(): Promise<void>;
  /** Capture window only; call it only when the user turned clipboard prefill on. */
  readClipboard(): Promise<string | undefined>;
  /** Capture window only: fires every time the window is opened. Returns an unsubscribe function. */
  onCaptureOpen(callback: () => void): () => void;
  /** Main window: fires when the vault search key was pressed (the listener checks the vault state). */
  onVaultSearch(callback: () => void): () => void;
  /** Main window: fires when the global voice key was pressed (the listener checks the voice switch). */
  onVoiceToggle(callback: () => void): () => void;
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
  /** Full screen, immersive mode, keep-awake (cockpit). */
  display: DisplayService;
  oauth: OAuthLoopback;
  localApi: LocalApiService;
  vaultBridge: VaultBridgeService;
  /** Home-network sync hub (desktop only). */
  lanHub: LanHubService;
  /** This PC's remote-control settings (desktop only; lives inside the hub). */
  remoteHost: RemoteHostService;
  /** Home-network sync, device side (Android). */
  lanClient: LanClientService;
  /** Wi-Fi available/lost for home-network sync (Android). */
  lanWatch: LanWatchService;
  /** Drive overview and read-only scans for the disk module (desktop only). */
  disk: DiskService;
  /** Read-only system facts for the system module (desktop only). */
  system: SystemService;
  /** HTTP(S) download manager (desktop only). */
  downloads: DownloadsService;
  /** BitTorrent engine of the download manager (desktop only). */
  torrent: TorrentService;
  /** Isolated tabs of the built-in browser (desktop only). */
  browser: BrowserService;
  /** The browser on Android: addresses open in a Custom Tab of the system browser. */
  customTabs: CustomTabsService;
  /** Magnet link / .torrent file a start was given, and the optional OS association (desktop). */
  launch: LaunchService;
  /** The built-in local language model (desktop only; stage 1 of the AI entry pipeline). */
  localModel: LocalModelService;
  desktop: DesktopService;
  share: ShareService;
  /** Offers a file to the user: browser download, or a "save as" dialog in the native shell. */
  saveFile(req: SaveFileRequest): Promise<'saved' | 'cancelled'>;
  clipboard: {
    /** Plain copy for non-secret text (e.g. the schema handed to an AI tool). */
    writeText(text: string): Promise<void>;
    /** Copies `text` and clears the clipboard after `clearAfterMs` – unless something else was copied meanwhile. */
    writeSensitive(text: string, clearAfterMs: number): Promise<void>;
    /**
     * Clears the clipboard now if the last sensitive value is still on it (e.g. when the vault locks)
     * and cancels the pending timer. A no-op when nothing sensitive was copied or it was replaced.
     */
    clearSensitive(): Promise<void>;
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
