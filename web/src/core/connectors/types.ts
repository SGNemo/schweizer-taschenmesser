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
}

/** Something the user can switch on; each may need its own OAuth scopes. */
export interface ConnectorFeature {
  id: string;
  label: string;
  description: string;
  scopes: string[];
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
  /** A valid OAuth access token; refreshed on demand. Rejects with `ConnectorError('expired')`. */
  accessToken(): Promise<string>;
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
  calendar?: CalendarCapability;
  mail?: MailCapability;
  /** Connectors without a login: true once they have what they need (an ICS address …). */
  isConfigured?(ctx: ConnectorContext): Promise<boolean>;
  /** Extra settings UI shown in the connector's card (an address form …). */
  settings?: () => Promise<{
    default: ComponentType<{ ctx: ConnectorContext; onChanged: () => void }>;
  }>;
}

export type ConnectorErrorCode =
  | 'expired'
  | 'rate-limited'
  | 'not-configured'
  | 'no-proxy'
  | 'network'
  | 'denied'
  | 'bad-response'
  | 'unsupported';

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
