/**
 * Connectors bring data from outside services into the app: calendars, mail-derived suggestions,
 * later more. A connector (`src/connectors/<id>/index.ts`) only talks to its service and returns
 * plain data; storing it is up to the modules (through manifest contributions), so a connector never
 * touches the database and never imports a module (both enforced by ESLint).
 *
 * Mail content is processed by local heuristics only – connector code must not import `core/ai`
 * (ESLint), so nothing that was read from a mailbox can reach a model.
 */
import type { ComponentType } from 'react';
import type { PlatformKind } from '@/core/platform/types';
import type { Recurrence } from '@/core/recurrence/types';
import type { SetupStepDef } from '@/core/setup/types';
import type { IconName } from '@/ui/icons';

export type ConnectorAuth = 'oauth-pkce' | 'api-key' | 'file' | 'deeplink' | 'none';

export type ConnectorState = 'disconnected' | 'connected' | 'expired' | 'rate-limited' | 'error';

/** Device-local status of a connector (`_meta`, never synced). */
export interface ConnectorStatus {
  state: ConnectorState;
  /** Optional features the user switched on (`ConnectorFeature.id`). */
  features: string[];
  /** Epoch ms of the last successful sync. */
  lastSyncAt?: number;
  /** Rate limit / backoff: do not call again before this epoch ms. */
  retryAt?: number;
  /** German, already redacted text for the settings card. */
  message?: string;
  /** Who is connected (mail address …), if the service tells. */
  account?: string;
}

export const DISCONNECTED: ConnectorStatus = { state: 'disconnected', features: [] };

export interface OAuthEndpoints {
  authUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  /** Extra query parameters of the authorization request (`access_type=offline` …). */
  authParams?: Record<string, string>;
  /**
   * Fixed loopback port for providers that compare the redirect URI exactly (Spotify). Busy → the
   * login fails with `port-busy`; the app never silently uses another port.
   */
  preferredPort?: number;
  /**
   * The PWA may log in too: the browser goes to the provider and comes back to
   * `<app address>/oauth/callback` (`core/connectors/oauthRedirect.ts`). Only for providers that accept
   * an https redirect and a PKCE login without a secret.
   */
  browserLogin?: boolean;
}

/** Something the user can switch on; each may need its own OAuth scopes. */
export interface ConnectorFeature {
  id: string;
  label: string;
  description: string;
  scopes: string[];
  /** `false`: not ticked by default (needs a scope most people do not need); the card still offers it. */
  defaultOn?: boolean;
}

export interface ExternalCalendar {
  id: string;
  name: string;
  color?: string;
  primary?: boolean;
}

/** One event of an external calendar, times as local wall-clock strings (like our own events). */
export interface ExternalEvent {
  /** Id inside the source calendar. */
  extId: string;
  etag?: string;
  title: string;
  allDay: boolean;
  startDate: string;
  startTime?: string;
  /** Last day, inclusive. */
  endDate?: string;
  endTime?: string;
  location?: string;
  note?: string;
  recurrence?: Recurrence;
  color?: string;
  /** Link that opens the event in the service. */
  url?: string;
  kind: 'event' | 'birthday' | 'gmail';
}

export interface CalendarSyncRequest {
  calendarId: string;
  /** Incremental token of the previous sync (absent = full sync). */
  syncToken?: string;
  /** Window of a full sync: 'YYYY-MM-DD'. */
  from: string;
  to: string;
}

export interface CalendarSyncResult {
  events: ExternalEvent[];
  /** Events that were removed or cancelled since the token. */
  removedIds: string[];
  nextSyncToken?: string;
  /** True when `events` is the complete window (stored events of this calendar not in it go away). */
  full: boolean;
}

export type MailFindingKind = 'invoice' | 'subscription' | 'event' | 'contract';

/** A suggestion derived from one message. Only extracted fields are kept, never the mail text. */
export interface MailFinding {
  kind: MailFindingKind;
  /** Stable reference: `gmail:<messageId>`. */
  ref: string;
  /** Headline: sender name or subject. */
  title: string;
  /** Link that opens the mail. */
  url?: string;
  /** 'YYYY-MM-DD' of the mail itself. */
  mailDate: string;
  amountMinor?: number;
  /** Due date (invoice), event date, contract end … */
  date?: string;
  time?: string;
  place?: string;
  /** Rhythm of a subscription. */
  freq?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  /** Notice period in days (contracts). */
  noticeDays?: number;
}

export interface MailScanRequest {
  /** 1, 3, 6 or 12. */
  months: number;
  /** 'YYYY-MM-DD' (today), so the scan is testable. */
  today: string;
  onProgress?(done: number, total: number): void;
}

/** What a connector may use; built by the framework (`core/connectors/context.ts`). */
export interface ConnectorContext {
  /** `fetch` of the platform (native: no CORS). */
  fetch: typeof fetch;
  /**
   * A valid OAuth access token; refreshed on demand. Rejects with `ConnectorError('expired')`.
   * `refresh: true` skips the in-memory token and gets a new one (after a 401).
   */
  accessToken(opts?: { refresh?: boolean }): Promise<string>;
  /**
   * Fetches a public URL (ICS/RSS feed). Native: directly; in the browser through the sync
   * server's proxy, or rejects with `ConnectorError('no-proxy')` when none is configured.
   */
  fetchPublic(url: string, init?: RequestInit): Promise<Response>;
  /** Small per-connector secrets (never synced). */
  secrets: {
    get(name: string): Promise<string | undefined>;
    set(name: string, value: string): Promise<void>;
    delete(name: string): Promise<void>;
  };
  /** Removes tokens and keys from a text before it may be shown or stored. */
  redact(text: string): string;
}

export interface CalendarCapability {
  listCalendars(ctx: ConnectorContext): Promise<ExternalCalendar[]>;
  sync(ctx: ConnectorContext, req: CalendarSyncRequest): Promise<CalendarSyncResult>;
}

export interface MailScanResult {
  findings: MailFinding[];
  /** How many messages were looked at (shown to the user: "N Mails gelesen"). */
  read: number;
}

export interface MailCapability {
  scan(ctx: ConnectorContext, req: MailScanRequest): Promise<MailScanResult>;
}

/** What is playing right now. Title and artist are user data: device-local, never to the AI, never in reports. */
export interface NowPlaying {
  title: string;
  /** Artist, or the show of a podcast episode. */
  artist: string;
  playing: boolean;
  /** Link that opens the track in the service. */
  trackUrl?: string;
  /** Album (or nothing for a podcast episode); small cover image of the service's own CDN. */
  album?: string;
  coverUrl?: string;
  /** Position and length in milliseconds, as of the moment of the reading. */
  progressMs?: number;
  durationMs?: number;
}

export type NowPlayingCommand = 'pause' | 'play' | 'next' | 'previous';

/** What the player itself reports: device, volume, shuffle and repeat. Device-local, never stored. */
export interface PlayerState {
  device?: string;
  /** 0–100; absent when the device has no volume control. */
  volume?: number;
  shuffle?: boolean;
  repeat?: 'off' | 'track' | 'context';
}

export type MediaKind = 'track' | 'playlist' | 'album';

/** A track, playlist or album the user can start. Names are user data: shown on request, never stored. */
export interface MediaItem {
  kind: MediaKind;
  id: string;
  name: string;
  /** Artist of a track or album. */
  subtitle?: string;
  /** Tracks: album name, length in ms and a small cover of the service's own image host. */
  album?: string;
  durationMs?: number;
  coverUrl?: string;
}

/** The content of a playlist or album: its own details and the tracks (up to 200). Shown on request, never stored. */
export interface Tracklist {
  name: string;
  /** Owner of a playlist, artist of an album. */
  subtitle?: string;
  coverUrl?: string;
  /** How many tracks the whole list has (can be more than `items`). */
  total?: number;
  items: MediaItem[];
}

/** A device Spotify can play on right now. */
export interface PlayerDevice {
  id: string;
  name: string;
  /** "Computer", "Smartphone", "Speaker" … as the service names it. */
  type: string;
  active: boolean;
  volume?: number;
}

export interface PlayerQueue {
  current?: MediaItem;
  next: MediaItem[];
}

export interface SearchResult {
  tracks: MediaItem[];
  playlists: MediaItem[];
  albums: MediaItem[];
}

/** One of the user's own playlists. Names are user data: shown on request, never stored. */
export interface Playlist {
  id: string;
  name: string;
  /** Extras of the player's own list (the focus-round picker needs only id and name). */
  trackCount?: number;
  coverUrl?: string;
  owner?: string;
}

/** Optional capability of a media connector: what plays now, and a few remote controls. */
export interface NowPlayingSource {
  /** `undefined` = nothing is playing. */
  read(ctx: ConnectorContext): Promise<NowPlaying | undefined>;
  /** Rejects with `ConnectorError('premium-required')` when the service only controls for paid accounts. */
  control(ctx: ConnectorContext, command: NowPlayingCommand): Promise<void>;
  /** The user's own playlists (one page), for the focus-round music. Needs its own feature/scope. */
  playlists?(ctx: ConnectorContext): Promise<Playlist[]>;
  /** Starts the playlist with this id on the active device. */
  startPlaylist?(ctx: ConnectorContext, id: string): Promise<void>;
  /** Device, volume, shuffle and repeat of the active player; `undefined` = no active device. */
  state?(ctx: ConnectorContext): Promise<PlayerState | undefined>;
  seek?(ctx: ConnectorContext, ms: number): Promise<void>;
  setVolume?(ctx: ConnectorContext, percent: number): Promise<void>;
  setShuffle?(ctx: ConnectorContext, on: boolean): Promise<void>;
  setRepeat?(ctx: ConnectorContext, mode: 'off' | 'track' | 'context'): Promise<void>;
  /** Searches tracks, playlists and albums. The typed words go to the service; nothing is kept. */
  search?(ctx: ConnectorContext, query: string): Promise<SearchResult>;
  /** The user's most recently saved songs (one page). Needs its own feature/scope. */
  likedSongs?(ctx: ConnectorContext): Promise<MediaItem[]>;
  /** Starts a track (optionally with the following `queue`), playlist or album on the active device. */
  play?(ctx: ConnectorContext, item: MediaItem, queue?: MediaItem[]): Promise<void>;
  /** The tracks of a playlist or album (up to 200), with its name and cover. */
  tracks?(ctx: ConnectorContext, kind: 'playlist' | 'album', id: string): Promise<Tracklist>;
  /** Starts one track inside its playlist or album, so playback goes on with the rest of it. */
  playFrom?(
    ctx: ConnectorContext,
    context: { kind: 'playlist' | 'album'; id: string },
    trackId: string,
  ): Promise<void>;
  /** The songs played most recently (about 30, each once). Needs its own feature/scope. */
  recent?(ctx: ConnectorContext): Promise<MediaItem[]>;
  queue?(ctx: ConnectorContext): Promise<PlayerQueue>;
  addToQueue?(ctx: ConnectorContext, trackId: string): Promise<void>;
  devices?(ctx: ConnectorContext): Promise<PlayerDevice[]>;
  /** Moves the playback to another device and keeps it playing. */
  transfer?(ctx: ConnectorContext, deviceId: string): Promise<void>;
  /** For each id: is the song in the user's saved songs? (up to 50 ids) */
  saved?(ctx: ConnectorContext, ids: string[]): Promise<boolean[]>;
  /** Saves or removes songs in the user's saved songs ("Lieblingssongs"). */
  save?(ctx: ConnectorContext, ids: string[], on: boolean): Promise<void>;
}

export interface ConnectorDef {
  id: string;
  name: string;
  description: string;
  icon: IconName;
  authType: ConnectorAuth;
  /** Where "connect" works; the card explains the rest. */
  platforms: PlatformKind[];
  oauth?: OAuthEndpoints;
  /** Explains a limit ("Nur am PC"), shown on platforms that cannot connect. */
  unavailableHint?: string;
  features: ConnectorFeature[];
  /** Optional steps for the setup assistant; ids must start with `<connector id>.`. */
  setupSteps?: SetupStepDef[];
  calendar?: CalendarCapability;
  mail?: MailCapability;
  nowPlaying?: NowPlayingSource;
  /**
   * Own wording for the client-id form of the card (default: the Google text, incl. its "Testing"
   * note); `secret: false` hides the secret field; `note` replaces the note below the form.
   */
  client?: { title: string; intro: string; secret?: boolean; note?: string };
  /** Connectors without a login: true once they have what they need (an ICS address …). */
  isConfigured?(ctx: ConnectorContext): Promise<boolean>;
  /**
   * Extra settings UI shown in the connector's card (an address form …). Bundled with the settings
   * page on purpose: a separate chunk cannot be fetched while the device is offline.
   */
  settings?: ComponentType<{ ctx: ConnectorContext; onChanged: () => void }>;
  /** Names of the private secrets of `ctx.secrets`, so "reset this device" can remove them too. */
  secretNames?: readonly string[];
}

export type ConnectorErrorCode =
  | 'expired'
  | 'rate-limited'
  | 'not-configured'
  | 'no-proxy'
  | 'network'
  | 'denied'
  | 'bad-response'
  | 'unsupported'
  | 'port-busy'
  | 'premium-required'
  /** The browser never reached the loopback callback (provider error page, wrong redirect URI). */
  | 'no-callback'
  /** The token endpoint rejected the client id. */
  | 'bad-client'
  /** The system browser could not be opened for the login. */
  | 'no-browser';

/** Failure of a connector call; the message never contains secrets (see `redact`). */
export class ConnectorError extends Error {
  constructor(
    readonly code: ConnectorErrorCode,
    message: string = code,
    /** Seconds until a rate limit lifts, when the service says. */
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'ConnectorError';
  }
}
