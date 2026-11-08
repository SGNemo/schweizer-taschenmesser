/**
 * "Was geht ins Netz": every destination the app can contact, grouped by the reason the connection
 * log uses, with when it happens. Derived from the code: `catalogue.test.ts` scans the source for
 * addresses and fails when one that the log files under a reason is missing here, or when a host
 * listed here no longer appears in the code. Addresses the user types in (own sync server, feeds,
 * a custom AI endpoint) cannot be listed; `own` marks the reasons that use them.
 */
import type { NetReason } from './netlog';

/** `auto`: without a click (can be switched off) · `setup`: only after the user set it up · `click`: only on a click. */
export type NetWhen = 'auto' | 'setup' | 'click';

export interface NetUse {
  reason: NetReason;
  when: NetWhen;
  /** Fixed hosts from the code, as the connection log shows them. */
  hosts: readonly string[];
  /** Also an address the user enters (own server, feed, AI endpoint). */
  own?: boolean;
}

export const NET_CATALOGUE: readonly NetUse[] = [
  { reason: 'update', when: 'auto', hosts: ['api.github.com', 'github.com'] },
  { reason: 'sync', when: 'setup', hosts: [], own: true },
  { reason: 'push', when: 'setup', hosts: [], own: true },
  { reason: 'calendar', when: 'setup', hosts: [], own: true },
  {
    reason: 'ai',
    when: 'setup',
    hosts: [
      'api.openai.com',
      'generativelanguage.googleapis.com',
      'api.groq.com',
      'api.mistral.ai',
      'openrouter.ai',
      'localhost:11434',
    ],
    own: true,
  },
  {
    reason: 'connector',
    when: 'setup',
    hosts: [
      'accounts.google.com',
      'oauth2.googleapis.com',
      'www.googleapis.com',
      'gmail.googleapis.com',
      'accounts.spotify.com',
      'api.spotify.com',
      'open.spotify.com',
    ],
  },
  {
    reason: 'weather',
    when: 'setup',
    hosts: [
      'api.open-meteo.com',
      'geocoding-api.open-meteo.com',
      'air-quality-api.open-meteo.com',
      'open-meteo.com',
    ],
  },
  {
    reason: 'maps',
    when: 'click',
    hosts: [
      'tile.openstreetmap.org',
      'nominatim.openstreetmap.org',
      'routing.openstreetmap.de',
      'api.transitous.org',
      'overpass-api.de',
    ],
  },
  { reason: 'currency', when: 'click', hosts: ['api.frankfurter.dev'] },
  { reason: 'ip', when: 'click', hosts: ['api.ipify.org'] },
  { reason: 'breach', when: 'click', hosts: ['api.pwnedpasswords.com'] },
  { reason: 'download', when: 'click', hosts: ['huggingface.co'] },
  { reason: 'other', when: 'setup', hosts: [], own: true },
];
