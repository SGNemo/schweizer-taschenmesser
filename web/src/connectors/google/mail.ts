/**
 * Gmail (read only, `gmail.readonly`): lists messages matching a keyword query and reads only the
 * headers From/Subject/Date/List-Unsubscribe plus the preview snippet of each. The message body
 * is never requested. Recognition is local (`heuristics.ts`).
 */
import { addDaysStr } from '@/core/time/dates';
import type {
  ConnectorContext,
  MailCapability,
  MailFinding,
  MailScanRequest,
  MailScanResult,
} from '@/core/connectors/types';
import { googleGet } from './http';
import { analyzeMessage, dedupeFindings, type MailMeta } from './heuristics';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
/** Keeps a scan bounded (and inside the per-user quota). */
const MAX_MESSAGES = 300;
const PAGE = 100;
const PARALLEL = 4;

const KEYWORDS = [
  'rechnung',
  'invoice',
  'zahlungserinnerung',
  'mahnung',
  'abo',
  'abonnement',
  'subscription',
  'mitgliedschaft',
  'verlängerung',
  'buchung',
  'buchungsbestätigung',
  'reservierung',
  'ticket',
  'termin',
  'einladung',
  'vertrag',
  'kündigung',
  'kündigungsfrist',
  'versicherung',
];

interface ApiMessage {
  id: string;
  snippet?: string;
  internalDate?: string;
  payload?: { headers?: { name: string; value: string }[] };
}

export function buildQuery(today: string, months: number): string {
  const after = addDaysStr(today, -Math.round(months * 30.4)).replaceAll('-', '/');
  return `after:${after} (${KEYWORDS.join(' OR ')}) -in:spam -in:trash`;
}

async function listIds(ctx: ConnectorContext, q: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < MAX_MESSAGES) {
    const { json } = await googleGet(ctx, `${API}/messages`, {
      q,
      maxResults: String(Math.min(PAGE, MAX_MESSAGES - ids.length)),
      pageToken,
    });
    const body = json as { messages?: { id: string }[]; nextPageToken?: string };
    for (const m of body.messages ?? []) ids.push(m.id);
    pageToken = body.nextPageToken;
    if (!pageToken) break;
  }
  return ids;
}

async function readMeta(ctx: ConnectorContext, id: string): Promise<MailMeta | undefined> {
  const { json } = await googleGet(ctx, `${API}/messages/${encodeURIComponent(id)}`, {
    format: 'metadata',
    metadataHeaders: ['From', 'Subject', 'Date', 'List-Unsubscribe'],
  });
  const m = json as ApiMessage;
  const header = (name: string) =>
    m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
  const dateMs = Number(m.internalDate) || Date.parse(header('Date'));
  if (!Number.isFinite(dateMs)) return undefined;
  return {
    id: m.id ?? id,
    from: header('From'),
    subject: header('Subject'),
    snippet: m.snippet ?? '',
    dateMs,
    bulk: header('List-Unsubscribe') !== '',
  };
}

export const googleMail: MailCapability = {
  async scan(ctx: ConnectorContext, req: MailScanRequest): Promise<MailScanResult> {
    const ids = await listIds(ctx, buildQuery(req.today, req.months));
    const findings: MailFinding[] = [];
    let done = 0;
    req.onProgress?.(0, ids.length);
    for (let i = 0; i < ids.length; i += PARALLEL) {
      const batch = ids.slice(i, i + PARALLEL);
      const metas = await Promise.all(batch.map((id) => readMeta(ctx, id)));
      for (const meta of metas) {
        const f = meta && analyzeMessage(meta);
        if (f) findings.push(f);
      }
      done += batch.length;
      req.onProgress?.(done, ids.length);
    }
    return { findings: dedupeFindings(findings), read: ids.length };
  },
};
