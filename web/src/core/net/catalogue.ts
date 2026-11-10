/**
 * "Was überhaupt ins Netz gehen kann": every fixed destination in the app's code, grouped by the
 * reason the connection log uses, with when it happens. `catalogue.test.ts` scans the source (string
 * literals and regex sources) and fails when a host the log files under a reason is missing here, or
 * when a host listed here no longer appears in the code. Addresses the user enters or opens (own sync
 * server, feeds, mail, browser module, downloads) cannot be listed; `own` and the `other` row name
 * them. Native traffic (browser webview, downloads, LAN sync) is not in the log; the UI says so.
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
      'i.scdn.co',
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
    own: true,
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
